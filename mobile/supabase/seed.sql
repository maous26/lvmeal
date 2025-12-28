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
'guidelines', 'anses', 'ANSES - Nutri-Score', '{"topic": "nutriscore", "confidence": 0.95}');

-- Note: Les embeddings seront generes via le script d'ingestion
-- qui appellera l'API OpenAI pour chaque entree
