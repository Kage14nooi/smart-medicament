"""Client Redis pub/sub partage par l'agent Monitoring (communication inter-agents = Redis uniquement).

Reconnexion automatique : la lib redis-py retente nativement la connexion TCP
(retry_on_timeout / socket_keepalive) mais nous ajoutons ici un retry explicite
au moment de la publication pour ne jamais perdre silencieusement un evenement
(le pipeline SMA depend de cette publication pour se declencher en aval) : en
cas d'echec, on logue un warning explicite plutot que de laisser l'exception
remonter silencieusement ou de crasher le process appelant.
"""
import os
import json
import time
import redis

from logging_config import get_logger

logger = get_logger("agent-monitoring.redis")

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))

CANAL_SEUIL_CRITIQUE = "stock:seuil_critique"

_client = None


def get_redis_client():
    global _client
    if _client is None:
        _client = redis.Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            decode_responses=True,
            socket_keepalive=True,
            socket_connect_timeout=5,
            retry_on_timeout=True,
            health_check_interval=30,
        )
    return _client


def publier(canal: str, payload: dict, tentatives: int = 3):
    """Publie sur Redis avec quelques tentatives en cas de coupure passagere.
    Ne leve jamais d'exception vers l'appelant : un echec de publication ne
    doit pas faire echouer la requete HTTP metier qui l'a declenche, mais doit
    etre visible dans les logs (warning), pas silencieux."""
    dernier_erreur = None
    for tentative in range(1, tentatives + 1):
        try:
            client = get_redis_client()
            client.publish(canal, json.dumps(payload))
            return True
        except redis.RedisError as err:
            dernier_erreur = err
            logger.warning(
                f"echec publication Redis sur '{canal}' (tentative {tentative}/{tentatives}) : {err}"
            )
            global _client
            _client = None  # force une reconnexion a la prochaine tentative
            time.sleep(0.2 * tentative)
    logger.error(f"publication Redis definitivement echouee sur '{canal}' apres {tentatives} tentatives : {dernier_erreur}")
    return False
