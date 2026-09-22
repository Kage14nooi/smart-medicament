"""Client Redis pub/sub partage par l'agent Prediction.

Reconnexion automatique + retry explicite a la publication (voir commentaire
dans agents/monitoring/redis_bus.py) : ne perd jamais un evenement en silence,
logue un warning en cas d'echec passager."""
import os
import json
import time
import redis

from logging_config import get_logger

logger = get_logger("agent-prediction.redis")

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))

CANAL_SEUIL_CRITIQUE = "stock:seuil_critique"
CANAL_PREDICTION_CALCULEE = "prediction:calculee"

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
            _client = None
            time.sleep(0.2 * tentative)
    logger.error(f"publication Redis definitivement echouee sur '{canal}' apres {tentatives} tentatives : {dernier_erreur}")
    return False
