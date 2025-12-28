-- Seed data for LymIA RAG Knowledge Base
-- Initial expert knowledge for French nutrition and wellness coaching

-- ============= NUTRITION =============

INSERT INTO knowledge_base (content, category, source, source_title, metadata) VALUES

-- Besoins caloriques
('Les besoins energetiques quotidiens varient selon le sexe, l''age et le niveau d''activite. Pour un adulte moderement actif: homme 2400-2600 kcal, femme 1800-2000 kcal. Ces valeurs doivent etre ajustees selon l''objectif: deficit de 300-500 kcal pour perte de poids, surplus de 200-300 kcal pour prise de masse.',
'nutrition', 'anses', 'ANSES - Reperes nutritionnels', '{"topic": "calories", "confidence": 0.95}'),

-- Proteines
('L''apport proteique recommande est de 0.83g/kg de poids corporel pour un adulte sedentaire. Pour les sportifs ou en phase de perte de poids, augmenter a 1.2-2g/kg pour preserver la masse musculaire. Sources de qualite: oeufs, poisson, viande maigre, legumineuses, produits laitiers.',
'nutrition', 'anses', 'ANSES - Proteines', '{"topic": "proteins", "confidence": 0.95}'),

-- Glucides
('Les glucides doivent representer 40-55% de l''apport energetique total. Privilegier les glucides complexes (cereales completes, legumineuses) aux sucres simples. L''index glycemique bas favorise une energie stable et reduit les fringales.',
'nutrition', 'anses', 'ANSES - Glucides', '{"topic": "carbs", "confidence": 0.90}'),

-- Lipides
('Les lipides doivent representer 35-40% de l''apport calorique. Privilegier les acides gras insatures (huile d''olive, poissons gras, noix). Limiter les graisses saturees a moins de 10% des calories totales.',
'nutrition', 'anses', 'ANSES - Lipides', '{"topic": "fats", "confidence": 0.90}'),

-- Hydratation
('L''apport hydrique recommande est de 1.5 a 2L d''eau par jour, davantage en cas d''activite physique ou chaleur. L''eau est essentielle au metabolisme, a la digestion et a l''elimination des toxines. Les signes de deshydratation: fatigue, maux de tete, urine foncee.',
'nutrition', 'anses', 'ANSES - Hydratation', '{"topic": "water", "confidence": 0.95}'),

-- ============= METABOLISME =============

-- Metabolisme de base
('Le metabolisme de base (MB) represente l''energie depensee au repos pour les fonctions vitales. Il depend de l''age, du sexe, du poids et de la masse musculaire. Formule de Mifflin-St Jeor: Homme = 10*poids + 6.25*taille - 5*age + 5. Femme = 10*poids + 6.25*taille - 5*age - 161.',
'metabolism', 'expert', 'Base expert - Metabolisme', '{"topic": "bmr", "confidence": 0.95}'),

-- Relance metabolique
('La relance metabolique vise a restaurer un metabolisme ralenti apres des regimes restrictifs. Principes: augmentation progressive des calories (100-150 kcal/semaine), maintien d''un apport proteique eleve, musculation pour augmenter la masse maigre, gestion du stress et du sommeil.',
'metabolism', 'expert', 'Base expert - Relance metabolique', '{"topic": "metabolic_repair", "confidence": 0.90}'),

-- Adaptation metabolique
('L''adaptation metabolique est la reduction du metabolisme en reponse a une restriction calorique prolongee. Pour l''eviter: ne pas descendre sous le MB, faire des pauses de regime (diet breaks), varier l''apport calorique, maintenir l''activite physique.',
'metabolism', 'expert', 'Base expert - Adaptation metabolique', '{"topic": "metabolic_adaptation", "confidence": 0.85}'),

-- NEAT
('Le NEAT (Non-Exercise Activity Thermogenesis) represente les calories brulees par les activites quotidiennes hors sport. Il peut varier de 200 a 900 kcal/jour. Augmenter le NEAT: marcher plus, prendre les escaliers, rester debout, faire des taches menageres.',
'metabolism', 'expert', 'Base expert - NEAT', '{"topic": "neat", "confidence": 0.90}'),

-- ============= WELLNESS =============

-- Sommeil et poids
('Le manque de sommeil (moins de 7h) augmente la ghréline (hormone de la faim) et reduit la leptine (hormone de satiete), favorisant la prise de poids. Objectif: 7-9h de sommeil de qualite. Eviter les ecrans 1h avant le coucher, maintenir une temperature fraiche.',
'wellness', 'inserm', 'INSERM - Sommeil et metabolisme', '{"topic": "sleep", "confidence": 0.90}'),

-- Stress et cortisol
('Le stress chronique eleve le cortisol, favorisant le stockage abdominal et les envies de sucre. Techniques de gestion: respiration profonde, meditation, activite physique reguliere, temps de relaxation quotidien.',
'wellness', 'has', 'HAS - Gestion du stress', '{"topic": "stress", "confidence": 0.85}'),

-- Bien-etre mental
('Le bien-etre mental influence directement les comportements alimentaires. L''alimentation emotionnelle est souvent liee au stress ou a l''ennui. Strategies: identifier les declencheurs, pratiquer la pleine conscience, avoir des alternatives saines.',
'wellness', 'expert', 'Base expert - Bien-etre mental', '{"topic": "mental_health", "confidence": 0.85}'),

-- ============= SPORT =============

-- Activite physique recommandations
('L''OMS recommande 150-300 min d''activite moderee ou 75-150 min d''activite intense par semaine, plus 2 seances de renforcement musculaire. Combiner cardio et musculation optimise la composition corporelle.',
'sport', 'has', 'HAS - Activite physique', '{"topic": "exercise_guidelines", "confidence": 0.95}'),

-- Musculation et metabolisme
('La musculation augmente la masse musculaire, elevant le metabolisme de base. Chaque kg de muscle brule environ 13 kcal/jour au repos. Privilegier les exercices polyarticulaires: squat, developpe, rowing, souleve de terre.',
'sport', 'expert', 'Base expert - Musculation', '{"topic": "strength_training", "confidence": 0.90}'),

-- Nutrition sportive
('Avant l''effort (1-2h): glucides complexes et proteines. Pendant (si >1h): hydratation et glucides simples. Apres (dans les 30min): proteines (20-30g) et glucides pour la recuperation.',
'sport', 'expert', 'Base expert - Nutrition sportive', '{"topic": "sports_nutrition", "confidence": 0.90}'),

-- ============= GUIDELINES =============

-- PNNS Recommandations
('Le PNNS recommande: 5 fruits et legumes/jour, feculents complets a chaque repas, legumineuses 2x/semaine, poisson 2x/semaine dont 1 gras, limiter viande rouge a 500g/semaine, 2-3 produits laitiers/jour, reduire sel, sucre et aliments ultra-transformes.',
'guidelines', 'anses', 'PNNS - Recommandations alimentaires', '{"topic": "pnns", "confidence": 0.95}'),

-- Nutri-Score
('Le Nutri-Score classe les aliments de A (meilleur) a E selon leur qualite nutritionnelle. Il prend en compte: energie, sucres, graisses saturees, sel (negatifs) et fibres, proteines, fruits/legumes (positifs). Privilegier A et B, limiter D et E.',
'guidelines', 'anses', 'ANSES - Nutri-Score', '{"topic": "nutriscore", "confidence": 0.95}'),

-- ============= RELANCE METABOLIQUE (Programme complet) =============

-- Phase 1: Decouverte
('Programme de relance metabolique - Phase 1 Decouverte (2 semaines): Objectif stabiliser les apports et etablir une base. Maintenir les calories au niveau du metabolisme de base estime. Marche quotidienne 20-30 min. Sommeil prioritaire 7-8h. Hydratation 2L/jour. Pas de restriction, pas de cardio intensif. Suivi quotidien du bien-etre.',
'metabolism', 'expert', 'LymIA - Relance Phase 1', '{"topic": "metabolic_boost_phase1", "program": "metabolic_boost", "phase": 1, "duration_weeks": 2, "confidence": 0.90}'),

-- Phase 2: Walking program
('Programme de relance metabolique - Phase 2 Marche Active (3 semaines): Augmentation progressive de l''activite sans stress metabolique. Marche 30-45 min/jour avec variations d''intensite. Introduction de seances de mobilite 2x/semaine. Augmentation calorique de 100 kcal/semaine si energie stable. Focus sur les proteines 1.6-2g/kg.',
'metabolism', 'expert', 'LymIA - Relance Phase 2', '{"topic": "metabolic_boost_phase2", "program": "metabolic_boost", "phase": 2, "duration_weeks": 3, "confidence": 0.90}'),

-- Phase 3: Resistance intro
('Programme de relance metabolique - Phase 3 Introduction Resistance (4 semaines): Construction de masse maigre pour relancer le metabolisme. 2-3 seances de renforcement musculaire/semaine. Exercices au poids du corps puis poids legers. Progression lente et securisee. Proteines maintenues hautes. Recuperation prioritaire entre seances.',
'metabolism', 'expert', 'LymIA - Relance Phase 3', '{"topic": "metabolic_boost_phase3", "program": "metabolic_boost", "phase": 3, "duration_weeks": 4, "confidence": 0.90}'),

-- Phase 4: Programme complet
('Programme de relance metabolique - Phase 4 Programme Complet (ongoing): Metabolisme relance, maintien des acquis. 3-4 seances sport/semaine mix cardio/muscu. Calories ajustees selon objectif (maintenance ou deficit doux). NEAT optimise au quotidien. Gestion du stress et sommeil maintenus.',
'metabolism', 'expert', 'LymIA - Relance Phase 4', '{"topic": "metabolic_boost_phase4", "program": "metabolic_boost", "phase": 4, "duration_weeks": 0, "confidence": 0.90}'),

-- Signaux d'un metabolisme ralenti
('Signes d''un metabolisme ralenti: fatigue persistante malgre un repos suffisant, frilosite frequente, difficulte a perdre du poids malgre deficit calorique, fringales intenses surtout sucrees, plateau prolonge (>4 semaines), cheveux/ongles fragiles, cycles menstruels irreguliers. Ces signes indiquent souvent une adaptation metabolique.',
'metabolism', 'expert', 'LymIA - Signes metabolisme lent', '{"topic": "slow_metabolism_signs", "confidence": 0.90}'),

-- NEAT et relance
('Le NEAT (Non-Exercise Activity Thermogenesis) est crucial dans la relance metabolique. Il represente jusqu''a 15% des depenses energetiques. Strategies pour l''augmenter: bureau debout, appels telephoniques en marchant, parking loin, escaliers, pauses actives toutes les heures, taches menageres, jardinage.',
'metabolism', 'expert', 'LymIA - NEAT et relance', '{"topic": "neat_metabolic_boost", "confidence": 0.90}'),

-- Alimentation relance metabolique
('Alimentation en phase de relance: priorite aux proteines (20-30g par repas), glucides complexes pour l''energie stable, lipides de qualite pour les hormones (omega-3, olive), fibres pour la satiete. Eviter: deficit trop agressif, suppression de groupes alimentaires, jeuner prolonge.',
'metabolism', 'expert', 'LymIA - Alimentation relance', '{"topic": "diet_metabolic_boost", "confidence": 0.90}'),

-- Sommeil et metabolisme
('Le sommeil est fondamental pour la relance metabolique. Pendant le sommeil: production de GH (hormone de croissance), regulation de la leptine et ghréline, recuperation musculaire. Objectif 7-9h. Rituels: meme heure de coucher, chambre fraiche 18-20°C, obscurite totale, pas d''ecrans 1h avant.',
'wellness', 'inserm', 'INSERM - Sommeil metabolisme', '{"topic": "sleep_metabolic_boost", "confidence": 0.90}'),

-- Stress cortisol et metabolisme
('Le cortisol chroniquement eleve freine la relance metabolique: stockage abdominal, catabolisme musculaire, resistance a l''insuline. Solutions: respiration 4-7-8 (inspirer 4s, tenir 7s, expirer 8s), marche en nature, yoga, limiter le cafe apres 14h, activites plaisir quotidiennes.',
'wellness', 'has', 'HAS - Cortisol metabolisme', '{"topic": "stress_metabolic_boost", "confidence": 0.90}'),

-- Progression et patience
('La relance metabolique prend du temps: minimum 8-12 semaines pour voir des resultats. Indicateurs de progres: energie accrue, meilleure qualite de sommeil, humeur stabilisee, force augmentee, faim regulee. Le poids peut rester stable ou augmenter legerement au debut (masse musculaire) - c''est normal et positif.',
'metabolism', 'expert', 'LymIA - Patience relance', '{"topic": "patience_metabolic_boost", "confidence": 0.85}'),

-- Exercices specifiques relance
('Exercices recommandes pour la relance metabolique: squats (cuisses/fessiers), fentes (equilibre/force), pompes (haut du corps), planche (gainage), rowing (dos), hip thrust (fessiers). Commencer au poids du corps, 2-3 series de 10-15 reps, repos 60-90s. Progression: ajouter poids quand 15 reps faciles.',
'sport', 'expert', 'LymIA - Exercices relance', '{"topic": "exercises_metabolic_boost", "confidence": 0.90}'),

-- ============= INITIATION SPORTIVE (Programme pour sedentaires) =============

-- Introduction au programme
('Le programme d''initiation sportive est concu pour les personnes sedentaires souhaitant reprendre une activite physique en douceur. Objectif: creer une habitude durable sans risque de blessure ou decouragement. 4 phases progressives sur 12+ semaines. Adapte au niveau de condition physique et aux contraintes de chacun.',
'sport', 'expert', 'LymIA - Initiation sportive', '{"topic": "sport_initiation_intro", "program": "sport_initiation", "confidence": 0.95}'),

-- Phase 1: Activation (2 semaines)
('Programme initiation sportive - Phase 1 Activation (2 semaines): Objectif reprendre le mouvement sans forcer. 10-15 min de marche quotidienne. Etirements doux 5 min le matin ou soir. Focus sur la regularite, pas l''intensite. Objectif: 5 jours actifs sur 7. Celebration des petites victoires. Ecoute du corps prioritaire.',
'sport', 'expert', 'LymIA - Initiation Phase 1', '{"topic": "sport_init_phase1", "program": "sport_initiation", "phase": 1, "duration_weeks": 2, "confidence": 0.90}'),

-- Exercices Phase 1
('Exercices Phase 1 Activation: Marche tranquille 10-15 min (rue, parc, tapis). Etirements: cou (rotations douces), epaules (cercles), hanches (rotations bassin), mollets (contre mur). Respiration profonde 5 respirations matin et soir. Optionnel: quelques squats contre mur si envie.',
'sport', 'expert', 'LymIA - Exercices Initiation Phase 1', '{"topic": "sport_init_exercises_phase1", "program": "sport_initiation", "phase": 1, "confidence": 0.90}'),

-- Phase 2: Mouvement (3 semaines)
('Programme initiation sportive - Phase 2 Mouvement (3 semaines): Augmentation progressive de l''activite. Marche 20-30 min quotidienne avec variations de rythme. Introduction de 2 seances de mobilite/semaine de 15 min. Premiers exercices au poids du corps (squats, pompes contre mur). Objectif: 45 min d''activite totale/jour.',
'sport', 'expert', 'LymIA - Initiation Phase 2', '{"topic": "sport_init_phase2", "program": "sport_initiation", "phase": 2, "duration_weeks": 3, "confidence": 0.90}'),

-- Exercices Phase 2
('Exercices Phase 2 Mouvement: Marche 20-30 min avec 2-3 accelerations de 1 min. Squats au mur (dos contre mur, descendre en position assise) 3x10. Pompes contre mur 3x10. Fentes avant alternees 2x8 par jambe. Planche sur genoux 3x20 secondes. Etirements 10 min apres chaque seance.',
'sport', 'expert', 'LymIA - Exercices Initiation Phase 2', '{"topic": "sport_init_exercises_phase2", "program": "sport_initiation", "phase": 2, "confidence": 0.90}'),

-- Phase 3: Renforcement (4 semaines)
('Programme initiation sportive - Phase 3 Renforcement (4 semaines): Construction de la force et endurance. 3 seances de renforcement musculaire/semaine de 20-30 min. Marche maintenue ou introduction jogging leger. Exercices au poids du corps avec progression. Introduction d''activites plaisir (velo, natation, danse).',
'sport', 'expert', 'LymIA - Initiation Phase 3', '{"topic": "sport_init_phase3", "program": "sport_initiation", "phase": 3, "duration_weeks": 4, "confidence": 0.90}'),

-- Exercices Phase 3
('Exercices Phase 3 Renforcement: Squats classiques 3x12. Pompes (genoux ou classiques selon niveau) 3x10. Fentes marchees 3x10 par jambe. Planche 3x30 secondes. Mountain climbers 3x15. Pont fessier 3x15. Superman (dos) 3x12. Optionnel: course/marche alternee 1 min/1 min pendant 15 min.',
'sport', 'expert', 'LymIA - Exercices Initiation Phase 3', '{"topic": "sport_init_exercises_phase3", "program": "sport_initiation", "phase": 3, "confidence": 0.90}'),

-- Phase 4: Autonomie (ongoing)
('Programme initiation sportive - Phase 4 Autonomie (ongoing): Maintien des acquis et personnalisation. 3-4 seances sport/semaine selon preferences. Mix cardio et renforcement. Exploration de nouvelles activites. Objectifs personnels (5km, premier cours collectif, etc.). Le sport devient un plaisir, plus une contrainte.',
'sport', 'expert', 'LymIA - Initiation Phase 4', '{"topic": "sport_init_phase4", "program": "sport_initiation", "phase": 4, "duration_weeks": 0, "confidence": 0.90}'),

-- Conseils pour sedentaires
('Conseils pour reprendre le sport apres sedentarite: commencer tres doucement (mieux vaut trop peu que trop), ecouter son corps (douleur = stop), privilegier la regularite a l''intensite, choisir des activites plaisantes, ne pas se comparer aux autres, celebrer chaque seance completee, accepter les jours sans.',
'sport', 'expert', 'LymIA - Conseils sedentaires', '{"topic": "sedentary_advice", "program": "sport_initiation", "confidence": 0.90}'),

-- Gestion des obstacles
('Obstacles courants et solutions pour reprendre le sport: "Pas le temps" = 10 min suffisent, fractionner dans la journee. "Trop fatigue" = l''exercice doux donne de l''energie. "J''ai mal" = adapter les exercices, consulter si persistant. "Pas motive" = trouver un partenaire, varier les activites, rappeler les benefices.',
'sport', 'expert', 'LymIA - Obstacles sport', '{"topic": "sport_obstacles", "program": "sport_initiation", "confidence": 0.90}'),

-- Benefices progressifs
('Benefices attendus du programme initiation sportive: Semaine 1-2: meilleur sommeil, regain d''energie. Semaine 3-4: humeur stabilisee, moins de stress. Semaine 5-8: force accrue, endurance amelioree. Semaine 9+: habitude installee, transformation visible, confiance en soi renforcee.',
'sport', 'expert', 'LymIA - Benefices initiation', '{"topic": "sport_init_benefits", "program": "sport_initiation", "confidence": 0.90}'),

-- Nutrition et sport pour debutants
('Nutrition pour accompagner la reprise sportive: hydratation avant/pendant/apres (eau plate). Collation legere 1-2h avant si faim (banane, biscuits secs). Apres l''effort: proteines + glucides dans l''heure (yaourt + fruit, oeuf + pain). Eviter l''exercice a jeun au debut.',
'sport', 'expert', 'LymIA - Nutrition initiation sport', '{"topic": "nutrition_sport_beginners", "program": "sport_initiation", "confidence": 0.90}'),

-- Adaptation selon profil
('Adaptation du programme selon le profil: Surpoids = privilegier exercices sans impact (marche, velo, piscine), proteger les articulations. Douleurs articulaires = mobilite douce, renforcement musculaire cible. Fatigue chronique = seances courtes, recuperation prioritaire. Stress eleve = yoga, marche nature, respiration.',
'sport', 'expert', 'LymIA - Adaptation profil sport', '{"topic": "sport_profile_adaptation", "program": "sport_initiation", "confidence": 0.90}');

-- Note: Les embeddings seront generes via le script d'ingestion
-- qui appellera l'API OpenAI pour chaque entree
