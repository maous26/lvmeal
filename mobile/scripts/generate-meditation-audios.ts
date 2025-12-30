#!/usr/bin/env npx ts-node
/**
 * Script de pré-génération des audios de méditation
 *
 * Ce script génère les 8 audios de méditation via Gemini TTS
 * et les upload sur Supabase Storage.
 *
 * Usage:
 *   npx ts-node scripts/generate-meditation-audios.ts
 *
 * Pré-requis:
 *   - GOOGLE_AI_API_KEY (ou EXPO_PUBLIC_GEMINI_API_KEY)
 *   - EXPO_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY (pour upload)
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

// Charger les variables d'environnement
dotenv.config({ path: path.join(__dirname, '../.env') })

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const GEMINI_API_KEY = process.env.GOOGLE_AI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY || ''

const MEDITATION_BUCKET = 'meditations'

// Sessions de méditation (copie de meditation-tts-service.ts)
const MEDITATION_SESSIONS = [
  {
    id: 'wk1_body_scan',
    title: 'Scan Corporel',
    week: 1,
    phase: 'foundations',
    durationMinutes: 10,
    script: `Bienvenue dans cette méditation de scan corporel.
Installez-vous confortablement, allongé ou assis.
Fermez doucement les yeux.

Commencez par prendre trois grandes respirations profondes.
Inspirez... et expirez lentement.

Portez maintenant votre attention sur vos pieds.
Ressentez le contact avec le sol ou le matelas.
Relâchez toute tension dans vos orteils, vos voûtes plantaires, vos chevilles.

Remontez doucement vers vos mollets et vos genoux.
Laissez-les se détendre complètement.

Continuez vers vos cuisses et votre bassin.
Sentez le poids de votre corps s'enfoncer confortablement.

Votre ventre se relâche à chaque expiration.
Votre dos s'enfonce un peu plus dans le support.

Vos épaules s'abaissent naturellement.
Vos bras, vos mains, vos doigts se détendent.

Relâchez votre mâchoire, votre front, le contour de vos yeux.
Tout votre visage est paisible.

Restez quelques instants dans cette sensation de calme total.
Votre corps entier est détendu, présent, en paix.

Quand vous serez prêt, reprenez doucement conscience de l'espace autour de vous.
Bougez légèrement vos doigts, vos orteils.
Et ouvrez les yeux quand vous le souhaitez.

Merci pour cette pratique.`,
  },
  {
    id: 'wk2_breath_anchor',
    title: 'Ancre du Souffle',
    week: 2,
    phase: 'foundations',
    durationMinutes: 10,
    script: `Bienvenue dans cette méditation sur le souffle.
Trouvez une position confortable et fermez les yeux.

Votre souffle est votre ancre.
Il est toujours là, disponible, patient.

Commencez simplement par observer votre respiration naturelle.
Ne cherchez pas à la modifier.
Juste observer.

Où sentez-vous le souffle le plus clairement ?
Peut-être au niveau des narines, ce léger flux d'air frais à l'inspiration.
Peut-être dans la poitrine qui se soulève et s'abaisse.
Peut-être dans le ventre qui se gonfle et se dégonfle.

Choisissez cet endroit et restez-y.

À chaque inspiration, vous êtes présent.
À chaque expiration, vous vous détendez un peu plus.

Si votre esprit vagabonde, c'est normal.
C'est la nature de l'esprit.
Reconnaissez simplement cette pensée, et revenez doucement au souffle.

Inspirez... conscience.
Expirez... relâchement.

Votre souffle est votre refuge permanent.
Il est toujours là pour vous ramener au moment présent.

Continuez à respirer tranquillement pendant quelques instants.

Quand vous serez prêt, reprenez conscience de votre environnement.
Gardez cette sensation de calme avec vous.

Merci pour cette pratique.`,
  },
  {
    id: 'wk3_mindful_movement',
    title: 'Mouvement Conscient',
    week: 3,
    phase: 'awareness',
    durationMinutes: 12,
    script: `Bienvenue dans cette pratique de mouvement conscient.
Vous pouvez rester assis ou debout pour cette méditation.

Commencez par fermer les yeux et prendre quelques respirations profondes.

Nous allons bouger avec lenteur et attention.
Chaque mouvement devient une méditation.

Commencez par incliner doucement la tête vers la droite.
Sentez l'étirement sur le côté gauche de votre cou.
Restez là quelques respirations.

Revenez au centre.
Inclinez maintenant vers la gauche.
Sentez, respirez, observez.

Revenez au centre.

Roulez doucement les épaules vers l'arrière.
Une épaule après l'autre.
Sentez les muscles de votre dos qui s'étirent.

Si vous êtes assis, étirez vos bras vers le ciel.
Grandissez-vous vers le haut à l'inspiration.
Relâchez les bras à l'expiration.

Écoutez les messages de votre corps dans chaque mouvement.
Votre corps sait ce dont il a besoin.
Faites-lui confiance.

Terminez par quelques respirations profondes.
Ressentez l'énergie qui circule dans tout votre corps.

Vous pouvez ouvrir les yeux quand vous le souhaitez.

Merci pour cette pratique.`,
  },
  {
    id: 'wk4_stop_technique',
    title: 'Technique STOP',
    week: 4,
    phase: 'awareness',
    durationMinutes: 8,
    script: `Bienvenue dans cette pratique de la technique STOP.
C'est un outil simple et puissant pour vos journées chargées.

STOP signifie :
S - Stop. Arrêtez-vous.
T - Take a breath. Prenez une respiration.
O - Observe. Observez ce qui se passe.
P - Proceed. Repartez avec conscience.

Pratiquons ensemble.

S - STOP.
En ce moment, vous vous arrêtez.
Quoi que vous fassiez, vous faites une pause.

T - TAKE A BREATH.
Prenez une grande inspiration.
Sentez l'air entrer dans vos poumons.
Expirez lentement.

O - OBSERVE.
Qu'est-ce qui se passe dans votre corps ?
Y a-t-il des tensions ? Où ?
Quelles pensées traversent votre esprit ?
Quelles émotions sont présentes ?
Observez sans juger.

P - PROCEED.
Maintenant, vous pouvez repartir.
Mais avec conscience.
Avec un peu plus de clarté.

Vous pouvez utiliser cette technique n'importe quand.
Avant une réunion importante.
Quand vous vous sentez stressé.
En transition entre deux activités.

C'est votre bouton pause intérieur.

Utilisez-le souvent.

Merci pour cette pratique.`,
  },
  {
    id: 'wk5_emotional_space',
    title: 'Espace Émotionnel',
    week: 5,
    phase: 'awareness',
    durationMinutes: 12,
    script: `Bienvenue dans cette méditation sur les émotions.
Installez-vous confortablement et fermez les yeux.

Aujourd'hui, nous allons explorer nos émotions avec bienveillance.

Commencez par quelques respirations profondes.
Créez un espace intérieur d'accueil.

Maintenant, demandez-vous doucement :
Quelle émotion est présente en ce moment ?

Peut-être de la joie, de la tristesse, de l'anxiété, de la colère, de la peur.
Peut-être un mélange.
Ou peut-être quelque chose de plus subtil.

Quelle que soit l'émotion, ne la repoussez pas.
Accueillez-la comme une visiteuse.

Où sentez-vous cette émotion dans votre corps ?
Peut-être une tension dans la poitrine.
Un nœud dans l'estomac.
Une chaleur dans le visage.

Respirez directement vers cet endroit.
Envoyez-y de la douceur, de l'espace.

Dites-vous intérieurement :
C'est ok de ressentir cela.
Cette émotion a le droit d'être là.
Elle passera, comme toutes les émotions passent.

Continuez à respirer avec elle.
Pas contre elle.
Avec elle.

Sentez peut-être l'émotion qui s'adoucit légèrement.
Ou peut-être pas. Les deux sont ok.

Terminez en vous remerciant pour ce moment de courage.
Explorer nos émotions demande de la bravoure.

Ouvrez les yeux quand vous êtes prêt.

Merci pour cette pratique.`,
  },
  {
    id: 'wk6_active_listening',
    title: 'Écoute Active',
    week: 6,
    phase: 'balance',
    durationMinutes: 10,
    script: `Bienvenue dans cette méditation sur l'écoute.
Gardez les yeux ouverts ou fermés, comme vous préférez.

Nous allons développer notre capacité d'écoute profonde.

Commencez par quelques respirations pour vous centrer.

Maintenant, portez votre attention sur les sons autour de vous.
Les sons proches.
Les sons lointains.

N'essayez pas de les identifier ou de les juger.
Écoutez-les simplement comme de la musique.
Des notes qui apparaissent et disparaissent.

Peut-être entendez-vous :
Le bruit de la climatisation.
Des oiseaux au loin.
Le trafic.
Le silence entre les sons.

Chaque son est parfait tel qu'il est.
Vous n'avez rien à changer.
Juste écouter.

Cette qualité d'écoute, vous pouvez l'appliquer aux autres.
Écouter quelqu'un sans préparer votre réponse.
Sans juger.
Avec une présence totale.

C'est un cadeau rare que vous pouvez offrir.

Continuez à écouter quelques instants.
Puis, doucement, revenez à votre respiration.

Gardez cette qualité d'écoute avec vous aujourd'hui.

Merci pour cette pratique.`,
  },
  {
    id: 'wk7_loving_kindness',
    title: 'Bienveillance',
    week: 7,
    phase: 'balance',
    durationMinutes: 12,
    script: `Bienvenue dans cette méditation de bienveillance.
Fermez les yeux et installez-vous confortablement.

Nous allons cultiver l'amour bienveillant envers nous-mêmes et les autres.

Commencez par vous visualiser vous-même.
Imaginez-vous assis là, en train de méditer.
Avec toutes vos qualités et vos imperfections.

Répétez intérieurement ces phrases :
Puissé-je être heureux.
Puissé-je être en paix.
Puissé-je être en bonne santé.
Puissé-je vivre avec aisance.

Sentez la chaleur de ces vœux envers vous-même.

Maintenant, pensez à quelqu'un que vous aimez.
Un ami, un membre de votre famille.
Visualisez son visage souriant.

Envoyez-lui les mêmes vœux :
Puisses-tu être heureux.
Puisses-tu être en paix.
Puisses-tu être en bonne santé.
Puisses-tu vivre avec aisance.

Étendez maintenant ce cercle.
Pensez à quelqu'un de neutre. Peut-être un voisin, un commerçant.
Envoyez-lui ces mêmes vœux de bonheur et de paix.

Et si vous le pouvez, pensez à quelqu'un avec qui vous avez des difficultés.
Sans forcer, envoyez-lui aussi ces vœux.

Finalement, étendez cette bienveillance à tous les êtres.
Puissent tous les êtres être heureux.
Puissent tous les êtres être en paix.

Restez quelques instants dans cette lumière d'amour universel.

Ouvrez les yeux quand vous êtes prêt.

Merci pour cette pratique.`,
  },
  {
    id: 'wk8_freedom',
    title: 'Liberté Intérieure',
    week: 8,
    phase: 'harmony',
    durationMinutes: 15,
    script: `Bienvenue dans cette dernière méditation du programme.
Félicitations pour être arrivé jusqu'ici.

Fermez les yeux et prenez quelques respirations profondes.

Au cours de ces huit semaines, vous avez acquis des outils précieux.
Le scan corporel pour relâcher les tensions.
L'ancre du souffle pour revenir au présent.
Le mouvement conscient pour habiter votre corps.
La technique STOP pour les moments difficiles.
L'espace émotionnel pour accueillir ce qui est.
L'écoute active pour vous connecter aux autres.
La bienveillance pour ouvrir votre cœur.

Tous ces outils sont maintenant en vous.
Ils font partie de vous.

La pleine conscience n'est plus quelque chose que vous faites.
C'est quelque chose que vous êtes.

Vous pouvez accéder à cet espace de paix à tout moment.
Un souffle suffit.
Une pause suffit.
Une intention suffit.

Vous êtes libre.
Libre de choisir comment répondre à la vie.
Libre de revenir au présent quand l'esprit s'égare.
Libre de vous traiter avec compassion.

Cette liberté est votre droit de naissance.
Personne ne peut vous l'enlever.

Continuez à pratiquer, même quelques minutes par jour.
La méditation est comme un muscle. Elle se renforce avec l'usage.

Je vous souhaite un chemin de paix, de conscience et de joie.

Ouvrez les yeux quand vous êtes prêt.

Merci infiniment pour cette pratique.
Namaste.`,
  },
]

// Fonction pour convertir PCM en WAV
function pcmToWav(pcmBase64: string, sampleRate: number): Buffer {
  const binaryString = Buffer.from(pcmBase64, 'base64')
  const dataLength = binaryString.length

  // Créer le header WAV
  const wavHeaderLength = 44
  const totalLength = wavHeaderLength + dataLength

  const buffer = Buffer.alloc(totalLength)

  // RIFF header
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(totalLength - 8, 4)
  buffer.write('WAVE', 8)

  // fmt chunk
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16) // chunk size
  buffer.writeUInt16LE(1, 20) // audio format (PCM)
  buffer.writeUInt16LE(1, 22) // num channels
  buffer.writeUInt32LE(sampleRate, 24) // sample rate
  buffer.writeUInt32LE(sampleRate * 2, 28) // byte rate
  buffer.writeUInt16LE(2, 32) // block align
  buffer.writeUInt16LE(16, 34) // bits per sample

  // data chunk
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataLength, 40)

  // Copier les données PCM
  binaryString.copy(buffer, wavHeaderLength)

  return buffer
}

// Fonction pour générer l'audio via Gemini TTS
async function generateAudio(script: string): Promise<Buffer> {
  const payload = {
    contents: [
      {
        parts: [
          {
            text: `Voix apaisante et calme pour méditation guidée. Parle lentement avec des pauses naturelles entre les phrases. Ton doux et rassurant. Texte : ${script}`,
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: 'Kore',
          },
        },
      },
    },
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Erreur API Gemini: ${response.status} - ${errorText}`)
  }

  const result = await response.json()
  const audioBase64 = result.candidates[0].content.parts[0].inlineData.data

  return pcmToWav(audioBase64, 24000)
}

// Fonction pour uploader sur Supabase Storage
async function uploadToSupabase(supabase: ReturnType<typeof createClient>, sessionId: string, audioBuffer: Buffer): Promise<string> {
  const { error } = await supabase.storage
    .from(MEDITATION_BUCKET)
    .upload(`${sessionId}.wav`, audioBuffer, {
      contentType: 'audio/wav',
      upsert: true,
    })

  if (error) {
    throw new Error(`Erreur upload Supabase: ${error.message}`)
  }

  const { data } = supabase.storage
    .from(MEDITATION_BUCKET)
    .getPublicUrl(`${sessionId}.wav`)

  return data.publicUrl
}

// Fonction principale
async function main() {
  console.log('🧘 Génération des audios de méditation')
  console.log('=====================================\n')

  // Vérifier les clés API
  if (!GEMINI_API_KEY) {
    console.error('❌ Clé API Gemini manquante (GOOGLE_AI_API_KEY ou EXPO_PUBLIC_GEMINI_API_KEY)')
    process.exit(1)
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Configuration Supabase manquante (EXPO_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY)')
    process.exit(1)
  }

  // Créer le client Supabase avec la clé service
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Vérifier/créer le bucket
  const { data: buckets } = await supabase.storage.listBuckets()
  const bucketExists = buckets?.some(b => b.name === MEDITATION_BUCKET)

  if (!bucketExists) {
    console.log(`📦 Création du bucket "${MEDITATION_BUCKET}"...`)
    const { error } = await supabase.storage.createBucket(MEDITATION_BUCKET, {
      public: true,
      fileSizeLimit: 52428800, // 50MB
    })
    if (error) {
      console.error(`❌ Erreur création bucket: ${error.message}`)
      process.exit(1)
    }
    console.log('✅ Bucket créé\n')
  }

  // Générer et uploader chaque session
  const results: { id: string; title: string; url: string; status: string }[] = []

  for (const session of MEDITATION_SESSIONS) {
    console.log(`\n🎵 Session ${session.week}/8: ${session.title}`)
    console.log(`   ID: ${session.id}`)

    try {
      // Vérifier si l'audio existe déjà
      const { data: existingFiles } = await supabase.storage
        .from(MEDITATION_BUCKET)
        .list('', { search: `${session.id}.wav` })

      if (existingFiles?.some(f => f.name === `${session.id}.wav`)) {
        console.log('   ⏭️  Déjà existant, skip')
        const { data } = supabase.storage
          .from(MEDITATION_BUCKET)
          .getPublicUrl(`${session.id}.wav`)
        results.push({ id: session.id, title: session.title, url: data.publicUrl, status: 'skipped' })
        continue
      }

      // Générer l'audio
      console.log('   🔊 Génération audio via Gemini TTS...')
      const audioBuffer = await generateAudio(session.script)
      console.log(`   📦 Taille: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`)

      // Uploader sur Supabase
      console.log('   ☁️  Upload sur Supabase Storage...')
      const publicUrl = await uploadToSupabase(supabase, session.id, audioBuffer)
      console.log(`   ✅ Terminé: ${publicUrl}`)

      results.push({ id: session.id, title: session.title, url: publicUrl, status: 'generated' })

      // Petite pause entre les appels API
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch (error) {
      console.error(`   ❌ Erreur: ${error}`)
      results.push({ id: session.id, title: session.title, url: '', status: 'error' })
    }
  }

  // Résumé
  console.log('\n\n📊 RÉSUMÉ')
  console.log('=========')
  console.log(`Total: ${results.length} sessions`)
  console.log(`Générées: ${results.filter(r => r.status === 'generated').length}`)
  console.log(`Existantes: ${results.filter(r => r.status === 'skipped').length}`)
  console.log(`Erreurs: ${results.filter(r => r.status === 'error').length}`)

  console.log('\n📝 URLs des audios:')
  for (const r of results) {
    if (r.url) {
      console.log(`   ${r.id}: ${r.url}`)
    }
  }
}

main().catch(console.error)
