import { useState } from 'react'
import './Legal.css'

const TABS = [
  { id: 'mentions', label: 'Mentions Legales' },
  { id: 'cgu', label: 'CGU' },
  { id: 'privacy', label: 'Politique de Confidentialite' },
]

export default function Legal({ onBack }) {
  const [activeTab, setActiveTab] = useState('mentions')

  return (
    <div className="legal-page">
      {onBack && (
        <button className="legal-back-btn" onClick={onBack}>
          &#8592; Retour
        </button>
      )}

      <h1 className="legal-title">Informations Legales</h1>

      <div className="legal-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`legal-tab${activeTab === tab.id ? ' legal-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="legal-content">
        {activeTab === 'mentions' && <MentionsLegales />}
        {activeTab === 'cgu' && <CGU />}
        {activeTab === 'privacy' && <PrivacyPolicy />}
      </div>

      <p className="legal-update-date">Derniere mise a jour : 9 avril 2025</p>
    </div>
  )
}

/* ==============================
   MENTIONS LEGALES
   ============================== */
function MentionsLegales() {
  return (
    <div className="legal-section">
      <h2>Mentions Legales</h2>
      <p>
        Conformement aux dispositions de la loi n&deg; 2004-575 du 21 juin 2004
        pour la confiance dans l'economie numerique (LCEN), il est porte a la
        connaissance des utilisateurs du site <strong>StreamCards</strong> les
        informations suivantes :
      </p>

      <h3>1. Editeur du site</h3>
      <p>
        Le site StreamCards est un projet personnel / non commercial.<br />
        <strong>Responsable de la publication :</strong> [Votre Nom / Pseudo]<br />
        <strong>Email de contact :</strong> [votre-email@exemple.com]<br />
        <strong>Statut :</strong> Personne physique (projet personnel)
      </p>

      <h3>2. Hebergement</h3>
      <p>
        <strong>Frontend :</strong> Heberge par Netlify, Inc. — 512 2nd Street,
        Suite 200, San Francisco, CA 94107, USA.<br />
        <strong>Backend :</strong> Heberge par Render Services, Inc. — 525 Brannan
        Street, Suite 300, San Francisco, CA 94107, USA.<br />
        <strong>Base de donnees :</strong> Hebergee par Supabase, Inc. (ou le
        fournisseur PostgreSQL utilise).
      </p>

      <h3>3. Propriete intellectuelle</h3>
      <p>
        Le code source de StreamCards est la propriete de son auteur. Les images
        de profil et noms d'utilisateur Twitch sont la propriete de leurs
        detenteurs respectifs et de Twitch Interactive, Inc. (filiale d'Amazon).
        Les visuels de cartes uploades par les streamers restent la propriete de
        leurs createurs respectifs.
      </p>

      <h3>4. Responsabilite</h3>
      <p>
        L'editeur ne saurait etre tenu responsable des contenus uploades par les
        utilisateurs (images de cartes, messages prives). Tout contenu illicite
        peut etre signale a l'adresse email de contact ci-dessus et sera retire
        dans les meilleurs delais.
      </p>

      <h3>5. Liens vers des sites tiers</h3>
      <p>
        StreamCards utilise l'API Twitch pour l'authentification et certaines
        fonctionnalites. L'editeur n'est pas responsable du contenu ou des
        pratiques de confidentialite de Twitch ou de tout autre service tiers.
      </p>
    </div>
  )
}

/* ==============================
   CONDITIONS GENERALES D'UTILISATION
   ============================== */
function CGU() {
  return (
    <div className="legal-section">
      <h2>Conditions Generales d'Utilisation (CGU)</h2>
      <p>
        En accedant et en utilisant le site StreamCards, vous acceptez sans
        reserve les presentes conditions generales d'utilisation.
      </p>

      <h3>1. Description du service</h3>
      <p>
        StreamCards est une plateforme gratuite de collection de cartes virtuelles
        liees a l'univers Twitch. Les utilisateurs peuvent :
      </p>
      <ul>
        <li>Se connecter via leur compte Twitch</li>
        <li>Acheter des boosters avec des coins virtuels (monnaie fictive, sans valeur reelle)</li>
        <li>Collectionner, echanger et vendre des cartes virtuelles sur le marche interne</li>
        <li>Participer a des encheres entre utilisateurs</li>
        <li>Envoyer des messages prives a leurs amis</li>
      </ul>

      <h3>2. Monnaie virtuelle</h3>
      <p>
        Les <strong>coins</strong> utilises sur StreamCards sont une monnaie
        purement virtuelle et fictive. Ils n'ont <strong>aucune valeur monetaire
        reelle</strong> et ne peuvent en aucun cas etre echanges, vendus ou
        convertis en argent reel. Les coins sont obtenus gratuitement via des
        recompenses quotidiennes, des quetes ou des points de chaine Twitch.
        <strong> Aucun achat en argent reel n'est propose sur StreamCards.</strong>
      </p>

      <h3>3. Inscription et compte</h3>
      <p>
        L'inscription se fait exclusivement via l'authentification Twitch OAuth.
        En vous connectant, vous autorisez StreamCards a acceder aux informations
        de base de votre compte Twitch (identifiant, nom d'utilisateur, photo de
        profil, email). Vous etes responsable de la securite de votre compte
        Twitch.
      </p>

      <h3>4. Comportement des utilisateurs</h3>
      <p>Les utilisateurs s'engagent a :</p>
      <ul>
        <li>Ne pas uploader de contenus illicites, offensants ou portant atteinte aux droits de tiers</li>
        <li>Ne pas tenter de contourner les systemes de securite du site</li>
        <li>Ne pas utiliser de bots, scripts ou outils automatises pour manipuler le service</li>
        <li>Respecter les autres utilisateurs dans les messages et echanges</li>
      </ul>

      <h3>5. Contenus utilisateurs</h3>
      <p>
        Les streamers peuvent creer des cartes et boosters personnalises. En
        uploadant du contenu, vous garantissez detenir les droits necessaires sur
        les images utilisees. L'editeur se reserve le droit de supprimer tout
        contenu signale comme inapproprie ou enfreignant des droits de tiers.
        Tout contenu uploade est soumis a validation par un administrateur avant
        publication.
      </p>

      <h3>6. Propriete des cartes virtuelles</h3>
      <p>
        Les cartes virtuelles collectionnees sur StreamCards n'ont aucune valeur
        patrimoniale. Elles existent uniquement dans le cadre de la plateforme
        et ne conferent aucun droit de propriete intellectuelle a leur detenteur.
      </p>

      <h3>7. Disponibilite du service</h3>
      <p>
        StreamCards est fourni "tel quel", sans garantie de disponibilite
        permanente. L'editeur se reserve le droit d'interrompre, de modifier ou
        d'arreter le service a tout moment, sans preavis ni indemnisation.
      </p>

      <h3>8. Limitation de responsabilite</h3>
      <p>
        L'editeur ne saurait etre tenu responsable des dommages directs ou
        indirects resultant de l'utilisation ou de l'impossibilite d'utiliser le
        service, incluant la perte de cartes virtuelles ou de coins.
      </p>

      <h3>9. Modification des CGU</h3>
      <p>
        L'editeur se reserve le droit de modifier les presentes CGU a tout moment.
        Les utilisateurs seront informes des modifications via le site. La
        poursuite de l'utilisation du service apres modification vaut acceptation
        des nouvelles conditions.
      </p>

      <h3>10. Droit applicable</h3>
      <p>
        Les presentes CGU sont regies par le droit francais. Tout litige relatif
        a l'utilisation de StreamCards sera soumis aux tribunaux competents.
      </p>
    </div>
  )
}

/* ==============================
   POLITIQUE DE CONFIDENTIALITE
   ============================== */
function PrivacyPolicy() {
  return (
    <div className="legal-section">
      <h2>Politique de Confidentialite</h2>
      <p>
        La presente politique de confidentialite decrit comment StreamCards
        collecte, utilise et protege vos donnees personnelles, conformement au
        Reglement General sur la Protection des Donnees (RGPD - Reglement UE
        2016/679).
      </p>

      <h3>1. Responsable du traitement</h3>
      <p>
        Le responsable du traitement des donnees est l'editeur du site
        StreamCards.<br />
        <strong>Contact :</strong> [votre-email@exemple.com]
      </p>

      <h3>2. Donnees collectees</h3>
      <p>Lors de votre connexion via Twitch, nous collectons :</p>
      <table className="legal-table">
        <thead>
          <tr>
            <th>Donnee</th>
            <th>Source</th>
            <th>Finalite</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Identifiant Twitch (ID)</td>
            <td>Twitch OAuth</td>
            <td>Identification unique du compte</td>
          </tr>
          <tr>
            <td>Nom d'utilisateur et nom d'affichage</td>
            <td>Twitch OAuth</td>
            <td>Affichage dans l'interface</td>
          </tr>
          <tr>
            <td>Adresse email</td>
            <td>Twitch OAuth</td>
            <td>Communication (non partagee)</td>
          </tr>
          <tr>
            <td>Photo de profil (URL)</td>
            <td>Twitch OAuth</td>
            <td>Affichage dans l'interface</td>
          </tr>
          <tr>
            <td>Token d'acces Twitch</td>
            <td>Twitch OAuth</td>
            <td>Integration Twitch (Channel Points)</td>
          </tr>
        </tbody>
      </table>

      <p>Donnees generees par votre utilisation du service :</p>
      <ul>
        <li><strong>Collection de cartes</strong> — cartes obtenues, historique d'ouverture de boosters</li>
        <li><strong>Transactions</strong> — achats, ventes, echanges de cartes et coins virtuels</li>
        <li><strong>Messages prives</strong> — messages envoyes entre amis sur la plateforme</li>
        <li><strong>Liste d'amis</strong> — relations d'amitie entre utilisateurs</li>
        <li><strong>Fil d'activite</strong> — actions realisees (ouverture de packs, echanges, etc.)</li>
        <li><strong>Succes et progression</strong> — progression dans les quetes et succes</li>
      </ul>

      <h3>3. Base legale du traitement</h3>
      <ul>
        <li>
          <strong>Execution du contrat</strong> (art. 6.1.b RGPD) : le traitement
          est necessaire a la fourniture du service StreamCards auquel vous avez
          consenti en vous connectant.
        </li>
        <li>
          <strong>Interet legitime</strong> (art. 6.1.f RGPD) : securisation du
          service et prevention des abus (rate limiting, logs de securite).
        </li>
      </ul>

      <h3>4. Stockage et securite des donnees</h3>
      <ul>
        <li>Les donnees sont stockees dans une base de donnees PostgreSQL hebergee de maniere securisee.</li>
        <li>Les tokens d'acces Twitch sont stockes en base de donnees et ne sont jamais exposes cote client.</li>
        <li>L'authentification utilise des tokens JWT (JSON Web Token) stockes dans le localStorage de votre navigateur.</li>
        <li>Les communications entre votre navigateur et nos serveurs sont chiffrees via HTTPS.</li>
        <li>Un systeme de rate limiting protege contre les abus.</li>
      </ul>

      <h3>5. Cookies et stockage local</h3>
      <p>
        StreamCards <strong>n'utilise pas de cookies de tracking ou publicitaires</strong>.
        Seul le <strong>localStorage</strong> du navigateur est utilise pour
        stocker :
      </p>
      <ul>
        <li>Votre token d'authentification (JWT) — necessaire au fonctionnement du service</li>
        <li>L'etat du tutoriel (affiche/masque) — pour ne pas le re-afficher</li>
      </ul>
      <p>
        Aucun cookie tiers, aucun outil d'analytics (Google Analytics, etc.) et
        aucun traceur publicitaire n'est utilise.
      </p>

      <h3>6. Partage des donnees</h3>
      <p>Vos donnees ne sont <strong>jamais vendues</strong> a des tiers. Elles sont partagees uniquement avec :</p>
      <ul>
        <li>
          <strong>Twitch (Amazon)</strong> — dans le cadre de l'authentification
          OAuth et des fonctionnalites Channel Points (EventSub). Consultez la{' '}
          <a href="https://www.twitch.tv/p/legal/privacy-notice/" target="_blank" rel="noopener noreferrer">
            politique de confidentialite de Twitch
          </a>.
        </li>
        <li>
          <strong>Hebergeurs</strong> (Render, Netlify) — vos donnees transitent
          par leurs serveurs dans le cadre de l'hebergement du service.
        </li>
      </ul>
      <p>
        Certaines de vos informations sont visibles par les autres utilisateurs :
        nom d'utilisateur, photo de profil, collection de cartes, classement,
        et profil public.
      </p>

      <h3>7. Duree de conservation</h3>
      <ul>
        <li>
          <strong>Donnees de compte</strong> — conservees tant que votre compte
          est actif sur la plateforme.
        </li>
        <li>
          <strong>Messages prives</strong> — conserves tant que les deux
          utilisateurs concernes ont un compte actif.
        </li>
        <li>
          <strong>Historique de transactions</strong> — conserve pour la duree
          d'existence du compte a des fins d'integrite du service.
        </li>
      </ul>

      <h3>8. Vos droits (RGPD)</h3>
      <p>
        Conformement au RGPD, vous disposez des droits suivants sur vos donnees
        personnelles :
      </p>
      <ul>
        <li><strong>Droit d'acces</strong> — obtenir une copie de vos donnees personnelles</li>
        <li><strong>Droit de rectification</strong> — corriger des donnees inexactes</li>
        <li><strong>Droit a l'effacement</strong> — demander la suppression de votre compte et de vos donnees</li>
        <li><strong>Droit a la portabilite</strong> — recevoir vos donnees dans un format structure</li>
        <li><strong>Droit d'opposition</strong> — vous opposer au traitement de vos donnees</li>
        <li><strong>Droit a la limitation</strong> — restreindre le traitement de vos donnees</li>
      </ul>
      <p>
        Pour exercer l'un de ces droits, contactez-nous a l'adresse :
        <strong> [votre-email@exemple.com]</strong>. Nous nous engageons a
        repondre dans un delai de 30 jours.
      </p>

      <h3>9. Transfert de donnees hors UE</h3>
      <p>
        Nos hebergeurs (Render, Netlify) et Twitch sont bases aux Etats-Unis.
        Vos donnees peuvent donc etre transferees hors de l'Union Europeenne.
        Ces transferts sont encadres par les clauses contractuelles types (CCT)
        de la Commission europeenne et/ou le EU-U.S. Data Privacy Framework.
      </p>

      <h3>10. Securite</h3>
      <p>
        Nous mettons en oeuvre des mesures techniques et organisationnelles
        appropriees pour proteger vos donnees : chiffrement HTTPS, hachage des
        tokens sensibles, rate limiting, validation des entrees, et protection
        contre les injections SQL.
      </p>

      <h3>11. Mineurs</h3>
      <p>
        StreamCards n'est pas destine aux enfants de moins de 13 ans. Si vous
        etes mineur (moins de 16 ans dans l'UE), vous devez obtenir le
        consentement de votre representant legal avant d'utiliser le service.
      </p>

      <h3>12. Reclamation</h3>
      <p>
        Si vous estimez que vos droits ne sont pas respectes, vous pouvez
        introduire une reclamation aupres de la CNIL (Commission Nationale de
        l'Informatique et des Libertes) :{' '}
        <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">
          www.cnil.fr
        </a>
      </p>

      <h3>13. Modification de cette politique</h3>
      <p>
        Cette politique peut etre modifiee a tout moment. La date de derniere
        mise a jour est indiquee en bas de page. Nous vous encourageons a
        consulter regulierement cette page.
      </p>
    </div>
  )
}
