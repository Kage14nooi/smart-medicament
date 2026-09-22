import { useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, Pill } from 'lucide-react';
import { useAuth } from './AuthContext.jsx';

export default function LoginPage() {
  const { connecter, estConnecte, chargement } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  if (!chargement && estConnecte) {
    const destination = location.state?.from?.pathname || '/';
    return <Navigate to={destination} replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErreur(null);
    setEnvoiEnCours(true);
    try {
      await connecter(email, motDePasse);
      const destination = location.state?.from?.pathname || '/';
      navigate(destination, { replace: true });
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <div className="login-page">
      <div className="card login-card">
        <div className="login-brand">
          <span className="login-brand-icon" aria-hidden="true"><Pill size={22} /></span>
          <div>
            <h1>Depot de Medicaments</h1>
            <p className="sidebar-subtitle" style={{ color: 'var(--color-text-muted)' }}>Connexion au systeme de gestion de stock</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="login-form" noValidate>
          <div className="form-field">
            <label htmlFor="email">Adresse e-mail</label>
            <div className="input-with-icon">
              <Mail size={16} aria-hidden="true" />
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                required
              />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="mot_de_passe">Mot de passe</label>
            <div className="input-with-icon">
              <Lock size={16} aria-hidden="true" />
              <input
                id="mot_de_passe"
                type={motDePasseVisible ? 'text' : 'password'}
                autoComplete="current-password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                placeholder="********"
                required
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                className="input-toggle-visibility"
                onClick={() => setMotDePasseVisible((v) => !v)}
                aria-label={motDePasseVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                aria-pressed={motDePasseVisible}
              >
                {motDePasseVisible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
          </div>
          {erreur && (
            <div className="login-error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{erreur}</span>
            </div>
          )}
          <div className="form-actions" style={{ marginTop: 4 }}>
            <button type="submit" className="btn btn-primary" disabled={envoiEnCours} style={{ width: '100%' }}>
              {envoiEnCours && <span className="btn-spinner" aria-hidden="true" />}
              {envoiEnCours ? 'Connexion...' : 'Se connecter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
