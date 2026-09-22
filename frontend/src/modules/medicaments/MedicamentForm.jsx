import { useEffect, useState } from 'react';
import { AlertCircle, Save, X } from 'lucide-react';

const VIDE = {
  nom_medicament: '', dci: '', code_essentiel: '', forme_pharmaceutique: '',
  categorie_ved: 'E', categorie_abc: 'B', id_profil_saisonnier: '',
  stock_actuel: 0, stock_securite_jours: 7, prix_unitaire: 0,
};

export default function MedicamentForm({ profils, initial, onSubmit, onCancel }) {
  const [form, setForm] = useState(VIDE);
  const [erreurs, setErreurs] = useState({});
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const estModification = Boolean(initial);

  useEffect(() => {
    if (initial) {
      setForm({
        nom_medicament: initial.nom_medicament || '',
        dci: initial.dci || '',
        code_essentiel: initial.code_essentiel || '',
        forme_pharmaceutique: initial.forme_pharmaceutique || '',
        categorie_ved: initial.categorie_ved || 'E',
        categorie_abc: initial.categorie_abc || 'B',
        id_profil_saisonnier: initial.id_profil_saisonnier || '',
        stock_actuel: initial.stock_actuel ?? 0,
        stock_securite_jours: initial.stock_securite_jours ?? 7,
        prix_unitaire: initial.prix_unitaire ?? 0,
      });
    } else {
      setForm(VIDE);
    }
    setErreurs({});
  }, [initial]);

  function valider(donnees) {
    const err = {};
    if (!donnees.nom_medicament.trim()) err.nom_medicament = 'Le nom est requis';
    if (!donnees.dci.trim()) err.dci = 'La DCI est requise';
    if (!donnees.code_essentiel.trim()) err.code_essentiel = 'Le code essentiel est requis';
    if (Number(donnees.stock_securite_jours) <= 0) err.stock_securite_jours = 'Doit etre superieur a 0';
    if (Number(donnees.prix_unitaire) < 0) err.prix_unitaire = 'Ne peut pas etre negatif';
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
        ...form,
        id_profil_saisonnier: form.id_profil_saisonnier || null,
        stock_actuel: Number(form.stock_actuel),
        stock_securite_jours: Number(form.stock_securite_jours),
        prix_unitaire: Number(form.prix_unitaire),
      });
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <div className="section-title">{estModification ? 'Modifier le medicament' : 'Nouveau medicament'}</div>
      <div className="form-grid">
        <div className={`form-field${erreurs.nom_medicament ? ' has-error' : ''}`}>
          <label htmlFor="med-nom">Nom du medicament<span className="required-mark">*</span></label>
          <input id="med-nom" value={form.nom_medicament} onChange={(e) => majChamp('nom_medicament', e.target.value)} required
            aria-invalid={Boolean(erreurs.nom_medicament)} aria-describedby={erreurs.nom_medicament ? 'med-nom-err' : undefined} />
          {erreurs.nom_medicament && <span className="field-error" id="med-nom-err"><AlertCircle size={13} aria-hidden="true" />{erreurs.nom_medicament}</span>}
        </div>
        <div className={`form-field${erreurs.dci ? ' has-error' : ''}`}>
          <label htmlFor="med-dci">DCI<span className="required-mark">*</span></label>
          <input id="med-dci" value={form.dci} onChange={(e) => majChamp('dci', e.target.value)} required
            aria-invalid={Boolean(erreurs.dci)} aria-describedby={erreurs.dci ? 'med-dci-err' : undefined} />
          {erreurs.dci && <span className="field-error" id="med-dci-err"><AlertCircle size={13} aria-hidden="true" />{erreurs.dci}</span>}
        </div>
        <div className={`form-field${erreurs.code_essentiel ? ' has-error' : ''}`}>
          <label htmlFor="med-code">Code essentiel<span className="required-mark">*</span></label>
          <input id="med-code" value={form.code_essentiel} onChange={(e) => majChamp('code_essentiel', e.target.value)} required disabled={estModification}
            aria-invalid={Boolean(erreurs.code_essentiel)} aria-describedby={erreurs.code_essentiel ? 'med-code-err' : undefined} />
          {erreurs.code_essentiel && <span className="field-error" id="med-code-err"><AlertCircle size={13} aria-hidden="true" />{erreurs.code_essentiel}</span>}
        </div>
        <div className="form-field">
          <label htmlFor="med-forme">Forme pharmaceutique</label>
          <input id="med-forme" value={form.forme_pharmaceutique} onChange={(e) => majChamp('forme_pharmaceutique', e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="med-ved">Categorie VED</label>
          <select id="med-ved" value={form.categorie_ved} onChange={(e) => majChamp('categorie_ved', e.target.value)}>
            <option value="V">V - Vital</option>
            <option value="E">E - Essentiel</option>
            <option value="D">D - Discretionnaire</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="med-abc">Categorie ABC</label>
          <select id="med-abc" value={form.categorie_abc} onChange={(e) => majChamp('categorie_abc', e.target.value)}>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="med-profil">Profil saisonnier</label>
          <select id="med-profil" value={form.id_profil_saisonnier} onChange={(e) => majChamp('id_profil_saisonnier', e.target.value)}>
            <option value="">Aucun</option>
            {profils.map((p) => (
              <option key={p.id_profil} value={p.id_profil}>{p.nom_profil}</option>
            ))}
          </select>
        </div>
        {!estModification && (
          <div className="form-field">
            <label htmlFor="med-stock-initial">Stock initial</label>
            <input id="med-stock-initial" type="number" min="0" value={form.stock_actuel} onChange={(e) => majChamp('stock_actuel', e.target.value)} />
          </div>
        )}
        <div className={`form-field${erreurs.stock_securite_jours ? ' has-error' : ''}`}>
          <label htmlFor="med-stock-securite">Stock de securite (jours)<span className="required-mark">*</span></label>
          <input id="med-stock-securite" type="number" min="1" step="0.5" value={form.stock_securite_jours} onChange={(e) => majChamp('stock_securite_jours', e.target.value)} required
            aria-invalid={Boolean(erreurs.stock_securite_jours)} aria-describedby={erreurs.stock_securite_jours ? 'med-stock-securite-err' : undefined} />
          {erreurs.stock_securite_jours && <span className="field-error" id="med-stock-securite-err"><AlertCircle size={13} aria-hidden="true" />{erreurs.stock_securite_jours}</span>}
        </div>
        <div className={`form-field${erreurs.prix_unitaire ? ' has-error' : ''}`}>
          <label htmlFor="med-prix">Prix unitaire (cout)</label>
          <input id="med-prix" type="number" min="0" step="0.01" value={form.prix_unitaire} onChange={(e) => majChamp('prix_unitaire', e.target.value)}
            aria-invalid={Boolean(erreurs.prix_unitaire)} aria-describedby={erreurs.prix_unitaire ? 'med-prix-err' : undefined} />
          {erreurs.prix_unitaire && <span className="field-error" id="med-prix-err"><AlertCircle size={13} aria-hidden="true" />{erreurs.prix_unitaire}</span>}
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={envoiEnCours}>
          {envoiEnCours ? <span className="btn-spinner" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
          {estModification ? 'Enregistrer' : 'Creer'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={envoiEnCours}>
          <X size={15} aria-hidden="true" /> Annuler
        </button>
      </div>
    </form>
  );
}
