
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  Lock,
  UserRound,
  Pill,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || '/api';

export default function DemandeAccesPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nom_utilisateur: '',
    email: '',
    mot_de_passe: '',
    confirmation: ''
  });

  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);
  const [envoyee, setEnvoyee] = useState(false);

  function maj(champ, valeur) {
    setForm((f) => ({
      ...f,
      [champ]: valeur
    }));
  }

  async function soumettre(e) {
    e.preventDefault();
    setErreur('');

    if (form.mot_de_passe.length < 8) {
      return setErreur(
        'Le mot de passe doit contenir au moins 8 caractères.'
      );
    }

    if (form.mot_de_passe !== form.confirmation) {
      return setErreur(
        'Les deux mots de passe ne correspondent pas.'
      );
    }

    setChargement(true);

    try {
      const res = await fetch(
        `${API_BASE_URL}/auth/demande-acces`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            nom_utilisateur: form.nom_utilisateur,
            email: form.email,
            mot_de_passe: form.mot_de_passe
          })
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.error || 'Impossible d’envoyer la demande.'
        );
      }

      setEnvoyee(true);

    } catch (err) {
      setErreur(err.message);

    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="login-page">
      <div className="card login-card">

        <div className="login-brand">
          <span className="login-brand-icon">
            <Pill size={22} />
          </span>

          <div>
            <h1>Demande d'accès</h1>
            <p className="sidebar-subtitle">
              Créer une demande de compte
            </p>
          </div>
        </div>

        {envoyee ? (

          <div className="login-success" role="status">
            <CheckCircle2 size={30} />

            <h2>Demande envoyée</h2>

            <p>
              Votre demande a été transmise au superviseur.
              Vous pourrez vous connecter après son approbation.
            </p>

            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={() => navigate('/login')}
            >
              Retour à la connexion
            </button>
          </div>

        ) : (

          <form
            className="login-form"
            onSubmit={soumettre}
            noValidate
          >

            <div className="form-field">
              <label htmlFor="dem-nom">Nom complet</label>

              <div className="input-with-icon">
                <UserRound size={16} />

                <input
                  id="dem-nom"
                  value={form.nom_utilisateur}
                  onChange={e =>
                    maj('nom_utilisateur', e.target.value)
                  }
                  minLength={2}
                  maxLength={120}
                  required
                  placeholder="Votre nom complet"
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="dem-email">
                Adresse e-mail
              </label>

              <div className="input-with-icon">
                <Mail size={16} />

                <input
                  id="dem-email"
                  type="email"
                  value={form.email}
                  onChange={e =>
                    maj('email', e.target.value)
                  }
                  required
                  placeholder="vous@exemple.com"
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="dem-password">
                Mot de passe souhaité
              </label>

              <div className="input-with-icon">
                <Lock size={16} />

                <input
                  id="dem-password"
                  type="password"
                  autoComplete="new-password"
                  value={form.mot_de_passe}
                  onChange={e =>
                    maj('mot_de_passe', e.target.value)
                  }
                  minLength={8}
                  required
                  placeholder="8 caractères minimum"
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="dem-confirm">
                Confirmer le mot de passe
              </label>

              <div className="input-with-icon">
                <Lock size={16} />

                <input
                  id="dem-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={form.confirmation}
                  onChange={e =>
                    maj('confirmation', e.target.value)
                  }
                  required
                  placeholder="Répéter le mot de passe"
                />
              </div>
            </div>

            <p className="login-hint">
              Le rôle sera attribué par le superviseur
              après examen de votre demande.
            </p>

            {erreur && (
              <div className="login-error" role="alert">
                <AlertCircle size={16} />
                <span>{erreur}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={chargement}
            >
              {chargement
                ? 'Envoi...'
                : 'Envoyer ma demande'}
            </button>

            <Link
              className="auth-back-link"
              to="/login"
            >
              <ArrowLeft size={15} />
              Retour à la connexion
            </Link>

          </form>
        )}

      </div>
    </div>
  );
}
