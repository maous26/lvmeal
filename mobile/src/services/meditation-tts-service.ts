/**
 * Meditation TTS Service - Génération audio de méditations guidées
 *
 * Utilise l'API Gemini TTS pour générer des méditations vocales.
 * Les audios sont cachés localement pour une écoute offline.
 */

import { Paths, File, Directory } from 'expo-file-system'
import { Audio, type AVPlaybackStatus } from 'expo-av'
import Constants from 'expo-constants'

// Types
export interface MeditationSession {
  id: string
  title: string
  week: number
  script: string
  durationMinutes: number
  phase: 'foundations' | 'awareness' | 'balance' | 'harmony'
}

export interface MeditationAudioCache {
  sessionId: string
  localUri: string
  generatedAt: string
  durationSeconds: number
}

export type MeditationStatus = 'idle' | 'generating' | 'downloading' | 'ready' | 'playing' | 'paused' | 'error'

// Programme de méditations sur 8 semaines
export const MEDITATION_SESSIONS: MeditationSession[] = [
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

// Répertoire de cache pour les audios
const MEDITATION_CACHE_DIR = 'meditation_audio'

class MeditationTTSService {
  private sound: Audio.Sound | null = null
  private currentSessionId: string | null = null
  private cacheDir: Directory | null = null

  /**
   * Initialise le répertoire de cache
   */
  async initializeCache(): Promise<void> {
    this.cacheDir = new Directory(Paths.cache, MEDITATION_CACHE_DIR)
    if (!this.cacheDir.exists) {
      this.cacheDir.create()
    }
  }

  /**
   * Vérifie si un audio est en cache
   */
  async isAudioCached(sessionId: string): Promise<boolean> {
    if (!this.cacheDir) await this.initializeCache()
    const file = new File(this.cacheDir!, `${sessionId}.wav`)
    return file.exists
  }

  /**
   * Récupère le chemin local d'un audio caché
   */
  getLocalAudioPath(sessionId: string): string {
    if (!this.cacheDir) {
      this.cacheDir = new Directory(Paths.cache, MEDITATION_CACHE_DIR)
    }
    return new File(this.cacheDir, `${sessionId}.wav`).uri
  }

  /**
   * Génère l'audio TTS via Gemini API et le cache localement
   */
  async generateAndCacheAudio(
    session: MeditationSession,
    onProgress?: (status: MeditationStatus) => void
  ): Promise<string> {
    onProgress?.('generating')

    const apiKey = Constants.expoConfig?.extra?.geminiApiKey || process.env.EXPO_PUBLIC_GEMINI_API_KEY

    if (!apiKey) {
      throw new Error('Clé API Gemini non configurée')
    }

    try {
      const payload = {
        contents: [
          {
            parts: [
              {
                text: `Voix apaisante et calme pour méditation guidée. Parle lentement avec des pauses naturelles entre les phrases. Ton doux et rassurant. Texte : ${session.script}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Kore', // Voix calme et apaisante
              },
            },
          },
        },
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`)
      }

      const result = await response.json()
      const audioBase64 = result.candidates[0].content.parts[0].inlineData.data

      // Convertir PCM en WAV
      const wavBase64 = this.pcmToWavBase64(audioBase64, 24000)

      // Sauvegarder localement
      onProgress?.('downloading')
      if (!this.cacheDir) await this.initializeCache()
      const file = new File(this.cacheDir!, `${session.id}.wav`)
      file.write(wavBase64, { encoding: 'base64' })

      onProgress?.('ready')
      return file.uri
    } catch (error) {
      onProgress?.('error')
      console.error('Erreur génération audio:', error)
      throw error
    }
  }

  /**
   * Convertit les données PCM en format WAV (Base64)
   */
  private pcmToWavBase64(pcmBase64: string, sampleRate: number): string {
    // Décoder le Base64 en bytes
    const binaryString = atob(pcmBase64)
    const pcmLength = binaryString.length / 2 // 16-bit samples

    // Créer le header WAV
    const wavHeaderLength = 44
    const dataLength = binaryString.length
    const totalLength = wavHeaderLength + dataLength

    const buffer = new ArrayBuffer(totalLength)
    const view = new DataView(buffer)

    // RIFF header
    this.writeString(view, 0, 'RIFF')
    view.setUint32(4, totalLength - 8, true)
    this.writeString(view, 8, 'WAVE')

    // fmt chunk
    this.writeString(view, 12, 'fmt ')
    view.setUint32(16, 16, true) // chunk size
    view.setUint16(20, 1, true) // audio format (PCM)
    view.setUint16(22, 1, true) // num channels
    view.setUint32(24, sampleRate, true) // sample rate
    view.setUint32(28, sampleRate * 2, true) // byte rate
    view.setUint16(32, 2, true) // block align
    view.setUint16(34, 16, true) // bits per sample

    // data chunk
    this.writeString(view, 36, 'data')
    view.setUint32(40, dataLength, true)

    // Copier les données PCM
    for (let i = 0; i < binaryString.length; i++) {
      view.setUint8(wavHeaderLength + i, binaryString.charCodeAt(i))
    }

    // Convertir en Base64
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  /**
   * Joue un audio de méditation
   */
  async playAudio(
    sessionId: string,
    onStatusChange?: (status: AVPlaybackStatus) => void
  ): Promise<void> {
    // Arrêter l'audio précédent si nécessaire
    await this.stopAudio()

    const filePath = this.getLocalAudioPath(sessionId)
    if (!this.cacheDir) await this.initializeCache()
    const file = new File(this.cacheDir!, `${sessionId}.wav`)

    if (!file.exists) {
      throw new Error('Audio non trouvé en cache')
    }

    // Configurer l'audio pour la lecture en arrière-plan
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    })

    // Créer et jouer le son
    const { sound } = await Audio.Sound.createAsync(
      { uri: filePath },
      { shouldPlay: true },
      onStatusChange
    )

    this.sound = sound
    this.currentSessionId = sessionId
  }

  /**
   * Met en pause l'audio
   */
  async pauseAudio(): Promise<void> {
    if (this.sound) {
      await this.sound.pauseAsync()
    }
  }

  /**
   * Reprend la lecture
   */
  async resumeAudio(): Promise<void> {
    if (this.sound) {
      await this.sound.playAsync()
    }
  }

  /**
   * Arrête l'audio
   */
  async stopAudio(): Promise<void> {
    if (this.sound) {
      await this.sound.stopAsync()
      await this.sound.unloadAsync()
      this.sound = null
      this.currentSessionId = null
    }
  }

  /**
   * Définit la position de lecture
   */
  async seekTo(positionMillis: number): Promise<void> {
    if (this.sound) {
      await this.sound.setPositionAsync(positionMillis)
    }
  }

  /**
   * Récupère la session en cours de lecture
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId
  }

  /**
   * Supprime le cache audio
   */
  async clearCache(): Promise<void> {
    await this.stopAudio()
    if (!this.cacheDir) await this.initializeCache()
    if (this.cacheDir?.exists) {
      this.cacheDir.delete()
      this.cacheDir = null
      await this.initializeCache()
    }
  }

  /**
   * Récupère la taille du cache (approximatif)
   */
  async getCacheSize(): Promise<number> {
    if (!this.cacheDir) await this.initializeCache()
    if (!this.cacheDir?.exists) return 0

    // Note: L'API expo-file-system nouvelle version ne fournit pas directement la taille
    // On compte simplement le nombre de fichiers * taille estimée
    let totalSize = 0
    for (const session of MEDITATION_SESSIONS) {
      const file = new File(this.cacheDir!, `${session.id}.wav`)
      if (file.exists) {
        // Estimation ~2MB par fichier audio
        totalSize += 2 * 1024 * 1024
      }
    }

    return totalSize
  }
}

export const meditationTTSService = new MeditationTTSService()
export default meditationTTSService
