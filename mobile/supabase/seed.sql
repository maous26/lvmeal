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

-- ============= HABITUDES ALIMENTAIRES FRANÇAISES =============

-- Structure des repas français
INSERT INTO knowledge_base (content, category, source, source_title, metadata) VALUES

-- Petit-déjeuner français
('Le petit-dejeuner francais traditionnel (34% des Francais) se compose de tartines beurrees avec confiture ou miel, cafe ou the, et jus de fruit. 92% des petits-dejeuners sont pris a domicile. Les viennoiseries (croissants, pains au chocolat) sont reservees au week-end ou occasions speciales. 27% des Francais optent pour cereales ou viennoiseries industrielles. Le petit-dejeuner francais est traditionnellement sucre, contrairement aux pays anglo-saxons.',
'food_habits', 'ipsos', 'IPSOS - Petits-dejeuners francais', '{"meal_type": "breakfast", "complexity": "basique", "prep_time": 10, "confidence": 0.95}'),

-- Petit-déjeuner basique - recettes simples
('Recettes petit-dejeuner basique francais (moins de 4 ingredients): Tartines beurre-confiture (pain, beurre, confiture). Tartines miel (pain, beurre, miel). Bol de cereales (cereales, lait). Yaourt nature avec miel (yaourt, miel). Pain grille avec pate a tartiner. Cafe au lait simple. The avec tartines. Ces recettes prennent moins de 5-10 minutes.',
'recipes_basique', 'expert', 'LymIA - Petit-dej basique', '{"meal_type": "breakfast", "complexity": "basique", "max_ingredients": 4, "prep_time": 10, "confidence": 0.90}'),

-- Petit-déjeuner élaboré
('Recettes petit-dejeuner elabore francais (plus de 4 ingredients): Oeufs brouilles aux herbes avec toast (oeufs, beurre, ciboulette, pain, sel, poivre). Bowl petit-dej complet (flocons avoine, lait, banane, miel, fruits rouges, graines). Crepes maison (farine, oeufs, lait, sucre, beurre). Pancakes aux myrtilles. Omelette jambon-fromage. Ces recettes prennent 15-25 minutes.',
'recipes_elabore', 'expert', 'LymIA - Petit-dej elabore', '{"meal_type": "breakfast", "complexity": "elabore", "min_ingredients": 5, "prep_time": 20, "confidence": 0.90}'),

-- Déjeuner français - structure
('Le dejeuner francais traditionnel se prend a 13h (50% des Francais dejeunent a cette heure). Structure classique: entree (salade, soupe), plat principal (proteine + feculents + legumes), fromage optionnel, dessert. Aujourd''hui, beaucoup simplifient en un plat unique equilibre. Le dejeuner represente environ 35% de l''apport calorique journalier.',
'food_habits', 'insee', 'INSEE - Temps de l''alimentation', '{"meal_type": "lunch", "confidence": 0.95}'),

-- Déjeuner basique - recettes simples
('Recettes dejeuner basique francais (moins de 4 ingredients principaux, hors sel/poivre/huile): Pates au beurre et parmesan. Riz au thon. Omelette nature. Croque-monsieur (pain, jambon, fromage). Salade composee simple (salade, tomate, thon). Steak hache-puree. Poulet roti avec riz. Saucisse-lentilles. Quiche lorraine (pate, oeufs, lardons, creme). Ces plats prennent 10-20 minutes.',
'recipes_basique', 'expert', 'LymIA - Dejeuner basique', '{"meal_type": "lunch", "complexity": "basique", "max_ingredients": 4, "prep_time": 20, "confidence": 0.90}'),

-- Déjeuner élaboré
('Recettes dejeuner elabore francais (plus de 4 ingredients): Poulet basquaise (poulet, poivrons, tomates, oignons, ail, herbes). Boeuf bourguignon (boeuf, vin, carottes, oignons, champignons, lardons). Blanquette de veau. Gratin dauphinois complet. Salade nicoise (salade, thon, oeufs, olives, tomates, haricots verts, anchois). Hachis parmentier (viande, puree, oignons, herbes). Ces plats prennent 30-60 minutes ou plus.',
'recipes_elabore', 'expert', 'LymIA - Dejeuner elabore', '{"meal_type": "lunch", "complexity": "elabore", "min_ingredients": 5, "prep_time": 45, "confidence": 0.90}'),

-- Collation/Goûter français
('Le gouter francais (vers 16h) est une tradition nationale servie dans les ecoles depuis 1941. Composition typique: 2 aliments parmi fruits, produits laitiers, produits cerealiers. Exemples: yaourt nature + fruit, pain + chocolat, compote + biscuit. Eviter les produits industriels trop sucres. Le gouter aide a eviter les fringales du soir.',
'food_habits', 'expert', 'PNNS - Gouter francais', '{"meal_type": "snack", "complexity": "basique", "prep_time": 5, "confidence": 0.95}'),

-- Collation basique
('Collations basiques francaises (1-2 ingredients): Yaourt nature. Pomme ou banane. Fromage blanc. Poignee de noix (30g). Pain avec carre de chocolat. Compote. Tranche de pain d''epices. Ces collations prennent moins de 5 minutes et apportent 100-200 kcal.',
'recipes_basique', 'expert', 'LymIA - Collation basique', '{"meal_type": "snack", "complexity": "basique", "max_ingredients": 2, "prep_time": 5, "confidence": 0.95}'),

-- Dîner français - structure
('Le diner francais est traditionnellement plus leger que le dejeuner. Structure: soupe ou salade, plat leger, laitage ou fruit. Manger leger le soir favorise un meilleur sommeil car le corps a plus de mal a digerer un repas copieux en fin de journee. Le diner represente environ 30% de l''apport calorique.',
'food_habits', 'expert', 'Nutrition - Diner francais', '{"meal_type": "dinner", "confidence": 0.90}'),

-- Dîner basique
('Recettes diner basique francais (moins de 4 ingredients): Soupe de legumes (legumes, bouillon). Omelette aux fines herbes. Salade verte avec vinaigrette. Poisson papillote (poisson, citron, herbes). Oeufs a la coque avec mouillettes. Gaspacho. Tartine de chevre chaud sur salade. Veloute (legume au choix, creme). Ces plats prennent 10-20 minutes.',
'recipes_basique', 'expert', 'LymIA - Diner basique', '{"meal_type": "dinner", "complexity": "basique", "max_ingredients": 4, "prep_time": 20, "confidence": 0.90}'),

-- Dîner élaboré
('Recettes diner elabore francais (plus de 4 ingredients): Ratatouille (courgettes, aubergines, poivrons, tomates, oignons, ail, herbes). Gratin de legumes. Pot-au-feu (boeuf, carottes, poireaux, navets, pommes de terre). Soupe au pistou. Tarte aux legumes. Risotto aux champignons. Curry de legumes. Ces plats prennent 30-45 minutes.',
'recipes_elabore', 'expert', 'LymIA - Diner elabore', '{"meal_type": "dinner", "complexity": "elabore", "min_ingredients": 5, "prep_time": 40, "confidence": 0.90}'),

-- Aliments de base français
('Aliments les plus consommes en France (base du quotidien): FECULENTS: pates, riz, pommes de terre, pain. PROTEINES: poulet, boeuf hache, oeufs, thon, jambon. LEGUMES: tomates, carottes, courgettes, haricots verts, salade. PRODUITS LAITIERS: yaourt, fromage, lait, beurre, creme. FRUITS: pommes, bananes, oranges. Ces ingredients forment la base de 80% des repas francais.',
'food_habits', 'insee', 'INSEE - Consommation alimentaire', '{"topic": "staple_foods", "confidence": 0.95}'),

-- Plats préférés des Français
('Top 10 des plats preferes des Francais: 1. Raclette (hiver, convivial). 2. Magret de canard. 3. Moules-frites. 4. Couscous (adoption). 5. Blanquette de veau. 6. Boeuf bourguignon. 7. Gratin dauphinois. 8. Steak-frites. 9. Poulet roti. 10. Tartiflette. Les plats mijotes et conviviaux dominent, souvent associes aux repas en famille.',
'food_habits', 'statista', 'Statista - Plats preferes francais', '{"topic": "favorite_dishes", "confidence": 0.90}'),

-- Plats rapides du quotidien
('Plats rapides du quotidien francais (moins de 20 min): Pates carbonara express (pates, lardons, oeuf, parmesan). Riz cantonnais simple (riz, oeufs, petits pois, jambon). Croque-monsieur. Salade cesar rapide. Wrap poulet-crudites. Tortilla espagnole (oeufs, pommes de terre). Pates pesto. Ces plats repondent aux contraintes de temps des actifs.',
'recipes_basique', 'expert', 'LymIA - Plats rapides quotidien', '{"complexity": "basique", "prep_time": 20, "confidence": 0.90}'),

-- Évolution des habitudes
('Evolution des habitudes alimentaires francaises: le temps de preparation des repas a diminue de 25% entre 1986 et 2010. La consommation de plats prepares augmente de 4.4%/an. 60% des Francais consomment pates, riz ou legumes frais chaque semaine. Les proteines vegetales progressent: 31% consomment des desserts vegetaux, 28% des alternatives a la viande.',
'food_habits', 'insee', 'INSEE - Evolution alimentation', '{"topic": "food_trends", "confidence": 0.90}'),

-- Critères de choix actuels
('Criteres de choix alimentaires des Francais en 2024: 1. Prix (contexte inflation). 2. Sante/equilibre (59% prioritaire). 3. Diversite des produits (47%). 4. Saisonnalite (43%). 5. Origine locale. 36% ont augmente leur consommation de legumes frais, 23% les legumineuses. Le Nutri-Score influence de plus en plus les achats.',
'food_habits', 'harris', 'Harris Interactive - Alimentation 2024', '{"topic": "food_criteria_2024", "confidence": 0.90}'),

-- Niveau de cuisine
('Adaptation des recettes selon le niveau de cuisine: DEBUTANT = recettes avec moins de 5 etapes, cuisson simple (poele, four basique), pas de techniques complexes. INTERMEDIAIRE = peut gerer plusieurs preparations simultanees, maitrise les bases (sauces, cuissons variees). AVANCE = recettes elaborees, techniques precises (temperatures, timing), presentations soignees.',
'cooking_level', 'expert', 'LymIA - Niveaux cuisine', '{"topic": "cooking_levels", "confidence": 0.90}'),

-- Temps de cuisine réaliste
('Temps de cuisine realiste par profil: PRESSE (moins de 15 min) = recettes express, preparation minimale. QUOTIDIEN (15-30 min) = majorite des plats basiques, cuisson simple. WEEK-END (30-60 min) = plats elabores, mijotes. Adapter les suggestions au temps disponible declare par l''utilisateur pour garantir l''adherence au plan.',
'cooking_time', 'expert', 'LymIA - Temps cuisine', '{"topic": "cooking_time", "confidence": 0.90}'),

-- ============= CRITÈRES SANTÉ RECETTES =============

-- Critères de filtrage des recettes
('Criteres de sante pour filtrer les recettes: SUCRE = maximum 15g de sucre par portion pour un plat sale, maximum 25g pour un dessert. SODIUM = maximum 600mg par portion (OMS recommande moins de 2000mg/jour). GRAISSES SATUREES = maximum 5g par portion. Privilegier les recettes avec Nutri-Score A ou B. Eviter les plats avec plus de 30% des calories provenant du sucre ajoute.',
'health_criteria', 'oms', 'OMS - Recommandations nutritionnelles', '{"topic": "recipe_health_filters", "max_sugar_savory": 15, "max_sugar_dessert": 25, "max_sodium": 600, "max_saturated_fat": 5, "confidence": 0.95}'),

-- Ingrédients à surveiller
('Ingredients indicateurs de recettes trop sucrees: sucre, cassonade, miel, sirop (erable, agave), caramel, chocolat au lait, confiture, pate a tartiner, fruits confits, sucre glace. Attention aux sauces: ketchup, sauce barbecue, sauce aigre-douce, teriyaki. Pour les plats sales, limiter ces ingredients ou les remplacer par des alternatives moins sucrees.',
'health_criteria', 'expert', 'LymIA - Ingredients sucres', '{"topic": "high_sugar_ingredients", "category": "sugar_watch", "confidence": 0.90}'),

-- Ingrédients salés à surveiller
('Ingredients indicateurs de recettes trop salees: bouillon cube (souvent 5g sel/cube), sauce soja (1g sel/cuillere), olives saumurees, anchois, charcuterie (jambon, bacon, lardons), fromages affines (parmesan, roquefort, feta), cornichons, capres, moutarde. Preferer les versions allégées en sel ou reduire les quantites de moitie.',
'health_criteria', 'expert', 'LymIA - Ingredients sales', '{"topic": "high_sodium_ingredients", "category": "sodium_watch", "confidence": 0.90}'),

-- Recettes à privilégier pour enrichissement
('Recettes prioritaires pour enrichissement Gustar (equilibrees, adaptees au quotidien francais): Plats de legumes (ratatouille, gratin courgettes, poelees). Proteines maigres (poulet, poisson blanc, tofu). Salades composees. Soupes maison. Plats uniques equilibres (bowl, buddha bowl). Omelettes aux legumes. Pates aux legumes. Eviter: gratins tres fromages, plats en sauce creme, fritures, plats sucres-sales excessifs.',
'enrichment_priority', 'expert', 'LymIA - Recettes prioritaires enrichissement', '{"topic": "enrichment_priorities", "prefer": ["legumes", "proteines_maigres", "salades", "soupes", "bowls"], "avoid": ["gratins_fromage", "sauces_creme", "fritures", "sucre_sale"], "confidence": 0.90}'),

-- Catégories à exclure de l'enrichissement
('Categories de recettes a ne PAS enrichir (trop riches ou non adaptees): Desserts tres sucres (gateaux, tartes sucrees, mousses). Plats de fete (raclette, fondue, tartiflette). Fast-food adapte (burgers, pizzas riches). Cocktails et boissons sucrees. Confiseries. Patisseries. Ces plats peuvent etre proposes occasionnellement (repas plaisir) mais ne doivent pas etre dans le plan quotidien.',
'enrichment_exclusion', 'expert', 'LymIA - Recettes exclues enrichissement', '{"topic": "enrichment_exclusions", "excluded_categories": ["desserts_riches", "plats_fete", "fast_food", "patisseries", "confiseries"], "confidence": 0.95}');

-- Note: Les embeddings seront generes via le script d'ingestion
-- qui appellera l'API OpenAI pour chaque entree
