export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-10 text-gray-800">
      <h1 className="text-3xl font-bold text-[#0077B6] mb-2">Politique de Confidentialité</h1>
      <p className="text-gray-500 text-sm mb-6">Dernière mise à jour : 4 janvier 2025</p>

      <p className="mb-6">
        LYM (&quot;nous&quot;, &quot;notre&quot;, &quot;l&apos;application&quot;) s&apos;engage à protéger votre vie privée.
        Cette politique explique comment nous collectons, utilisons et protégeons vos données.
      </p>

      <h2 className="text-xl font-semibold text-[#0096C7] mt-8 mb-3">1. Données collectées</h2>
      <p className="mb-2">L&apos;application peut collecter les types de données suivants :</p>
      <ul className="list-disc pl-6 mb-4 space-y-1">
        <li><strong>Informations de profil</strong> : âge, sexe, poids, taille, niveau d&apos;activité (stockées localement sur votre appareil)</li>
        <li><strong>Données nutritionnelles</strong> : repas enregistrés, objectifs caloriques (stockées localement)</li>
        <li><strong>Photos</strong> : uniquement lorsque vous utilisez la fonction de scan d&apos;aliments (traitées pour analyse, non conservées)</li>
        <li><strong>Compte Google</strong> : si vous choisissez la synchronisation cloud, votre email est utilisé pour l&apos;authentification</li>
      </ul>

      <h2 className="text-xl font-semibold text-[#0096C7] mt-8 mb-3">2. Utilisation de la caméra</h2>
      <p className="mb-2">L&apos;application utilise l&apos;accès à la caméra pour :</p>
      <ul className="list-disc pl-6 mb-4 space-y-1">
        <li>Scanner les codes-barres des produits alimentaires</li>
        <li>Photographier vos repas pour analyse nutritionnelle automatique</li>
      </ul>
      <p className="mb-4">Les photos sont traitées pour extraire les informations nutritionnelles et ne sont pas stockées sur nos serveurs.</p>

      <h2 className="text-xl font-semibold text-[#0096C7] mt-8 mb-3">3. Stockage des données</h2>
      <p className="mb-2">Par défaut, toutes vos données sont stockées <strong>localement sur votre appareil</strong>. Si vous activez la synchronisation cloud :</p>
      <ul className="list-disc pl-6 mb-4 space-y-1">
        <li>Vos données sont chiffrées et stockées de manière sécurisée</li>
        <li>Vous pouvez supprimer vos données à tout moment depuis l&apos;application</li>
      </ul>

      <h2 className="text-xl font-semibold text-[#0096C7] mt-8 mb-3">4. Partage des données</h2>
      <p className="mb-2">Nous ne vendons ni ne partageons vos données personnelles avec des tiers, sauf :</p>
      <ul className="list-disc pl-6 mb-4 space-y-1">
        <li>Pour fournir les fonctionnalités de l&apos;application (ex: API d&apos;analyse nutritionnelle)</li>
        <li>Si requis par la loi</li>
      </ul>

      <h2 className="text-xl font-semibold text-[#0096C7] mt-8 mb-3">5. Services tiers</h2>
      <p className="mb-2">L&apos;application peut utiliser des services tiers pour :</p>
      <ul className="list-disc pl-6 mb-4 space-y-1">
        <li><strong>Authentification</strong> : Google Sign-In</li>
        <li><strong>Analyse nutritionnelle</strong> : OpenAI API (les données sont anonymisées)</li>
        <li><strong>Base de données alimentaires</strong> : Open Food Facts</li>
      </ul>

      <h2 className="text-xl font-semibold text-[#0096C7] mt-8 mb-3">6. Vos droits</h2>
      <p className="mb-2">Vous avez le droit de :</p>
      <ul className="list-disc pl-6 mb-4 space-y-1">
        <li>Accéder à vos données personnelles</li>
        <li>Rectifier vos données</li>
        <li>Supprimer vos données (effacer toutes les données depuis les paramètres)</li>
        <li>Retirer votre consentement à tout moment</li>
      </ul>

      <h2 className="text-xl font-semibold text-[#0096C7] mt-8 mb-3">7. Sécurité</h2>
      <p className="mb-4">Nous mettons en œuvre des mesures de sécurité appropriées pour protéger vos données contre tout accès non autorisé.</p>

      <h2 className="text-xl font-semibold text-[#0096C7] mt-8 mb-3">8. Contact</h2>
      <p className="mb-2">Pour toute question concernant cette politique de confidentialité, contactez-nous à :</p>
      <p className="mb-4"><strong>Email</strong> : contact@lym-app.com</p>

      <h2 className="text-xl font-semibold text-[#0096C7] mt-8 mb-3">9. Modifications</h2>
      <p>Nous nous réservons le droit de modifier cette politique. Les utilisateurs seront informés de tout changement significatif.</p>
    </div>
  )
}
