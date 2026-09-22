import { useState } from 'react';
import { AlertCircle, Info, Send } from 'lucide-react';

const TYPES = [
  { value: 'ENTREE', label: 'Entree (reapprovisionnement)' },
  { value: 'DISTRIBUTION', label: 'Distribution (sortie normale)' },
  { value: 'AJUSTEMENT', label: 'Ajustement (inventaire, +/-)' },
];

export default function MouvementForm({ medicaments, onSubmit }) {
  const [form, setForm] = useState({ id_medicament: '', type_mouvement: 'DISTRIBUTION', quantite_mouvement: 1 });
  const [erreurs, setErreurs] = useState({});
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  function valider(donnees) {
    const err = {};
    if (!donnees.id_medicament) err.id_medicament = 'Le medicament est requis';
    if (donnees.type_mouvement !== 'AJUSTEMENT' && Number(donnees.quantite_mouvement) <= 0) {
      err.quantite_mouvement = 'Doit etre superieur a 0';
    }
    if (donnees.type_mouvement === 'AJUSTEMENT' && Number(donnees.quantite_mouvement) === 0) {
      err.quantite_mouvement = 'Doit etre different de 0';
    }
    return err;
  }

  function majChamp(champ, valeur) {
    const next = { ...form, [champ]: valeur };
    setForm(next);
    // Validation en temps reel : si le champ etait en erreur, on le revalide a chaque frappe.
    if (erreurs[champ]) {
      setErreurs(valider(next));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const err = valider(form);
    setErreurs(err);
    if (Object.keys(err).length > 0) return;
    setEnvoiEnCours(true);
    try {
      await onSubmit({
        id_medicament: Number(form.id_medicament),
        type_mouvement: form.type_mouvement,
        quantite_mouvement: Number(form.quantite_mouvement),
        source_mouvement: 'SIMULATEUR_FRONTEND',
      });
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <div className="section-title">Simulateur de mouvement</div>
      <p style={{ color: '#667085', fontSize: 13, marginTop: -6, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <Info size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          Ce formulaire declenche le pipeline SMA complet : verification du stock, puis (si sous seuil) calcul de risque et proposition de commande.
        </span>
      </p>
      <div className="form-grid">
        <div className={`form-field${erreurs.id_medicament ? ' has-error' : ''}`}>
          <label htmlFor="mvt-medicament">Medicament<span className="required-mark">*</span></label>
          <select
            id="mvt-medicament"
            value={form.id_medicament}
            onChange={(e) => majChamp('id_medicament', e.target.value)}
            required
            aria-invalid={Boolean(erreurs.id_medicament)}
            aria-describedby={erreurs.id_medicament ? 'mvt-medicament-err' : undefined}
          >
            <option value="">Selectionner...</option>
            {medicaments.map((m) => (
              <option key={m.id_medicament} value={m.id_medicament}>
                {m.nom_medicament} (stock actuel : {m.stock_actuel})
              </option>
            ))}
          </select>
          {erreurs.id_medicament && <span className="field-error" id="mvt-medicament-err"><AlertCircle size={13} aria-hidden="true" />{erreurs.id_medicament}</span>}
        </div>
        <div className="form-field">
          <label htmlFor="mvt-type">Type de mouvement<span className="required-mark">*</span></label>
          <select id="mvt-type" value={form.type_mouvement} onChange={(e) => majChamp('type_mouvement', e.target.value)}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className={`form-field${erreurs.quantite_mouvement ? ' has-error' : ''}`}>
          <label htmlFor="mvt-quantite">{form.type_mouvement === 'AJUSTEMENT' ? 'Delta (+ ou -)' : 'Quantite'}<span className="required-mark">*</span></label>
          <input
            id="mvt-quantite"
            type="number"
            value={form.quantite_mouvement}
            onChange={(e) => majChamp('quantite_mouvement', e.target.value)}
            required
            aria-invalid={Boolean(erreurs.quantite_mouvement)}
            aria-describedby={erreurs.quantite_mouvement ? 'mvt-quantite-err' : undefined}
          />
          {erreurs.quantite_mouvement && <span className="field-error" id="mvt-quantite-err"><AlertCircle size={13} aria-hidden="true" />{erreurs.quantite_mouvement}</span>}
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={envoiEnCours}>
          {envoiEnCours ? <span className="btn-spinner" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
          Enregistrer le mouvement
        </button>
      </div>
    </form>
  );
}
