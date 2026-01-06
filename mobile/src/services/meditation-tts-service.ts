/**
 * Meditation TTS Service - Méditations guidées audio
 *
 * Télécharge les audios pré-générés depuis Supabase Storage
 * et les cache localement pour une écoute offline.
 */

import { Paths, File, Directory } from 'expo-file-system'
import { Audio, type AVPlaybackStatus } from 'expo-av'
import { getMeditationAudioUrl, isSupabaseConfigured } from './supabase-client'

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
Installe-toi confortablement, allongé ou assis.
Ferme doucement les yeux.

Commence par prendre trois grandes respirations profondes.
Inspire... et expire lentement.

Porte maintenant ton attention sur tes pieds.
Ressens le contact avec le sol ou le matelas.
Relâche toute tension dans tes orteils, tes voûtes plantaires, tes chevilles.

Remonte doucement vers tes mollets et tes genoux.
Laisse-les se détendre complètement.

Continue vers tes cuisses et ton bassin.
Sens le poids de ton corps s'enfoncer confortablement.

Ton ventre se relâche à chaque expiration.
Ton dos s'enfonce un peu plus dans le support.

Tes épaules s'abaissent naturellement.
Tes bras, tes mains, tes doigts se détendent.

Relâche ta mâchoire, ton front, le contour de tes yeux.
Tout ton visage est paisible.

Reste quelques instants dans cette sensation de calme total.
Ton corps entier est détendu, présent, en paix.

Quand tu seras prêt, reprends doucement conscience de l'espace autour de toi.
Bouge légèrement tes doigts, tes orteils.
Et ouvre les yeux quand tu le souhaites.

Merci pour cette pratique.`,
  },
  {
    id: 'wk2_breath_anchor',
    title: 'Ancre du Souffle',
    week: 2,
    phase: 'foundations',
    durationMinutes: 10,
    script: `Bienvenue dans cette méditation sur le souffle.
Trouve une position confortable et ferme les yeux.

Ton souffle est ton ancre.
Il est toujours là, disponible, patient.

Commence simplement par observer ta respiration naturelle.
Ne cherche pas à la modifier.
Juste observer.

Où sens-tu le souffle le plus clairement ?
Peut-être au niveau des narines, ce léger flux d'air frais à l'inspiration.
Peut-être dans la poitrine qui se soulève et s'abaisse.
Peut-être dans le ventre qui se gonfle et se dégonfle.

Choisis cet endroit et restes-y.

À chaque inspiration, tu es présent.
À chaque expiration, tu te détends un peu plus.

Si ton esprit vagabonde, c'est normal.
C'est la nature de l'esprit.
Reconnais simplement cette pensée, et reviens doucement au souffle.

Inspire... conscience.
Expire... relâchement.

Ton souffle est ton refuge permanent.
Il est toujours là pour te ramener au moment présent.

Continue à respirer tranquillement pendant quelques instants.

Quand tu seras prêt, reprends conscience de ton environnement.
Garde cette sensation de calme avec toi.

Merci pour cette pratique.`,
  },
  {
    id: 'wk3_mindful_movement',
    title: 'Mouvement Conscient',
    week: 3,
    phase: 'awareness',
    durationMinutes: 12,
    script: `Bienvenue dans cette pratique de mouvement conscient.
Tu peux rester assis ou debout pour cette méditation.

Commence par fermer les yeux et prendre quelques respirations profondes.

Nous allons bouger avec lenteur et attention.
Chaque mouvement devient une méditation.

Commence par incliner doucement la tête vers la droite.
Sens l'étirement sur le côté gauche de ton cou.
Reste là quelques respirations.

Reviens au centre.
Incline maintenant vers la gauche.
Sens, respire, observe.

Reviens au centre.

Roule doucement les épaules vers l'arrière.
Une épaule après l'autre.
Sens les muscles de ton dos qui s'étirent.

Si tu es assis, étire tes bras vers le ciel.
Grandis-toi vers le haut à l'inspiration.
Relâche les bras à l'expiration.

Écoute les messages de ton corps dans chaque mouvement.
Ton corps sait ce dont il a besoin.
Fais-lui confiance.

Termine par quelques respirations profondes.
Ressens l'énergie qui circule dans tout ton corps.

Tu peux ouvrir les yeux quand tu le souhaites.

Merci pour cette pratique.`,
  },
  {
    id: 'wk4_stop_technique',
    title: 'Technique STOP',
    week: 4,
    phase: 'awareness',
    durationMinutes: 8,
    script: `Bienvenue dans cette pratique de la technique STOP.
C'est un outil simple et puissant pour tes journées chargées.

STOP signifie :
S - Stop. Arrête-toi.
T - Take a breath. Prends une respiration.
O - Observe. Observe ce qui se passe.
P - Proceed. Repars avec conscience.

Pratiquons ensemble.

S - STOP.
En ce moment, tu t'arrêtes.
Quoi que tu fasses, tu fais une pause.

T - TAKE A BREATH.
Prends une grande inspiration.
Sens l'air entrer dans tes poumons.
Expire lentement.

O - OBSERVE.
Qu'est-ce qui se passe dans ton corps ?
Y a-t-il des tensions ? Où ?
Quelles pensées traversent ton esprit ?
Quelles émotions sont présentes ?
Observe sans juger.

P - PROCEED.
Maintenant, tu peux repartir.
Mais avec conscience.
Avec un peu plus de clarté.

Tu peux utiliser cette technique n'importe quand.
Avant une réunion importante.
Quand tu te sens stressé.
En transition entre deux activités.

C'est ton bouton pause intérieur.

Utilise-le souvent.

Merci pour cette pratique.`,
  },
  {
    id: 'wk5_emotional_space',
    title: 'Espace Émotionnel',
    week: 5,
    phase: 'awareness',
    durationMinutes: 12,
    script: `Bienvenue dans cette méditation sur les émotions.
Installe-toi confortablement et ferme les yeux.

Aujourd'hui, nous allons explorer nos émotions avec bienveillance.

Commence par quelques respirations profondes.
Crée un espace intérieur d'accueil.

Maintenant, demande-toi doucement :
Quelle émotion est présente en ce moment ?

Peut-être de la joie, de la tristesse, de l'anxiété, de la colère, de la peur.
Peut-être un mélange.
Ou peut-être quelque chose de plus subtil.

Quelle que soit l'émotion, ne la repousse pas.
Accueille-la comme une visiteuse.

Où sens-tu cette émotion dans ton corps ?
Peut-être une tension dans la poitrine.
Un nœud dans l'estomac.
Une chaleur dans le visage.

Respire directement vers cet endroit.
Envoie-y de la douceur, de l'espace.

Dis-toi intérieurement :
C'est ok de ressentir cela.
Cette émotion a le droit d'être là.
Elle passera, comme toutes les émotions passent.

Continue à respirer avec elle.
Pas contre elle.
Avec elle.

Sens peut-être l'émotion qui s'adoucit légèrement.
Ou peut-être pas. Les deux sont ok.

Termine en te remerciant pour ce moment de courage.
Explorer nos émotions demande de la bravoure.

Ouvre les yeux quand tu es prêt.

Merci pour cette pratique.`,
  },
  {
    id: 'wk6_active_listening',
    title: 'Écoute Active',
    week: 6,
    phase: 'balance',
    durationMinutes: 10,
    script: `Bienvenue dans cette méditation sur l'écoute.
Garde les yeux ouverts ou fermés, comme tu préfères.

Nous allons développer notre capacité d'écoute profonde.

Commence par quelques respirations pour te centrer.

Maintenant, porte ton attention sur les sons autour de toi.
Les sons proches.
Les sons lointains.

N'essaie pas de les identifier ou de les juger.
Écoute-les simplement comme de la musique.
Des notes qui apparaissent et disparaissent.

Peut-être entends-tu :
Le bruit de la climatisation.
Des oiseaux au loin.
Le trafic.
Le silence entre les sons.

Chaque son est parfait tel qu'il est.
Tu n'as rien à changer.
Juste écouter.

Cette qualité d'écoute, tu peux l'appliquer aux autres.
Écouter quelqu'un sans préparer ta réponse.
Sans juger.
Avec une présence totale.

C'est un cadeau rare que tu peux offrir.

Continue à écouter quelques instants.
Puis, doucement, reviens à ta respiration.

Garde cette qualité d'écoute avec toi aujourd'hui.

Merci pour cette pratique.`,
  },
  {
    id: 'wk7_loving_kindness',
    title: 'Bienveillance',
    week: 7,
    phase: 'balance',
    durationMinutes: 12,
    script: `Bienvenue dans cette méditation de bienveillance.
Ferme les yeux et installe-toi confortablement.

Nous allons cultiver l'amour bienveillant envers nous-mêmes et les autres.

Commence par te visualiser toi-même.
Imagine-toi assis là, en train de méditer.
Avec toutes tes qualités et tes imperfections.

Répète intérieurement ces phrases :
Puissé-je être heureux.
Puissé-je être en paix.
Puissé-je être en bonne santé.
Puissé-je vivre avec aisance.

Sens la chaleur de ces vœux envers toi-même.

Maintenant, pense à quelqu'un que tu aimes.
Un ami, un membre de ta famille.
Visualise son visage souriant.

Envoie-lui les mêmes vœux :
Puisses-tu être heureux.
Puisses-tu être en paix.
Puisses-tu être en bonne santé.
Puisses-tu vivre avec aisance.

Étends maintenant ce cercle.
Pense à quelqu'un de neutre. Peut-être un voisin, un commerçant.
Envoie-lui ces mêmes vœux de bonheur et de paix.

Et si tu le peux, pense à quelqu'un avec qui tu as des difficultés.
Sans forcer, envoie-lui aussi ces vœux.

Finalement, étends cette bienveillance à tous les êtres.
Puissent tous les êtres être heureux.
Puissent tous les êtres être en paix.

Reste quelques instants dans cette lumière d'amour universel.

Ouvre les yeux quand tu es prêt.

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

Ferme les yeux et prends quelques respirations profondes.

Au cours de ces huit semaines, tu as acquis des outils précieux.
Le scan corporel pour relâcher les tensions.
L'ancre du souffle pour revenir au présent.
Le mouvement conscient pour habiter ton corps.
La technique STOP pour les moments difficiles.
L'espace émotionnel pour accueillir ce qui est.
L'écoute active pour te connecter aux autres.
La bienveillance pour ouvrir ton cœur.

Tous ces outils sont maintenant en toi.
Ils font partie de toi.

La pleine conscience n'est plus quelque chose que tu fais.
C'est quelque chose que tu es.

Tu peux accéder à cet espace de paix à tout moment.
Un souffle suffit.
Une pause suffit.
Une intention suffit.

Tu es libre.
Libre de choisir comment répondre à la vie.
Libre de revenir au présent quand l'esprit s'égare.
Libre de te traiter avec compassion.

Cette liberté est ton droit de naissance.
Personne ne peut te l'enlever.

Continue à pratiquer, même quelques minutes par jour.
La méditation est comme un muscle. Elle se renforce avec l'usage.

Je te souhaite un chemin de paix, de conscience et de joie.

Ouvre les yeux quand tu es prêt.

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
   * Télécharge l'audio depuis Supabase Storage et le cache localement
   */
  async downloadAndCacheAudio(
    session: MeditationSession,
    onProgress?: (status: MeditationStatus) => void
  ): Promise<string> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase non configuré')
    }

    onProgress?.('downloading')

    try {
      // Récupérer l'URL publique de l'audio
      const audioUrl = getMeditationAudioUrl(session.id)
      if (!audioUrl) {
        throw new Error('URL audio non disponible')
      }

      // Télécharger le fichier
      const response = await fetch(audioUrl)
      if (!response.ok) {
        throw new Error(`Erreur téléchargement: ${response.status}`)
      }

      // Lire le contenu en ArrayBuffer puis convertir en base64
      const arrayBuffer = await response.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)

      // Sauvegarder localement (nouvelle API expo-file-system)
      if (!this.cacheDir) await this.initializeCache()
      const file = new File(this.cacheDir!, `${session.id}.wav`)
      file.write(bytes)

      onProgress?.('ready')
      return file.uri
    } catch (error) {
      onProgress?.('error')
      console.error('Erreur téléchargement audio:', error)
      throw error
    }
  }

  /**
   * @deprecated Utilisez downloadAndCacheAudio à la place
   * Conservé pour compatibilité avec le code existant
   */
  async generateAndCacheAudio(
    session: MeditationSession,
    onProgress?: (status: MeditationStatus) => void
  ): Promise<string> {
    return this.downloadAndCacheAudio(session, onProgress)
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
