"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEMO_EMAIL = void 0;
exports.ensureDemoSetup = ensureDemoSetup;
exports.createDemoSession = createDemoSession;
exports.demoUserFromRequest = demoUserFromRequest;
exports.demoScopeEmail = demoScopeEmail;
const node_crypto_1 = require("node:crypto");
const db_1 = require("./db");
/**
 * Anonymer Demo-Zugang.
 *
 * Die App selbst kennt keine Benutzer. Damit Demo-Daten die echte Bibliothek nicht
 * verschmutzen, bekommt jede Zeile in `offers` einen `owner_email`. Zeilen ohne Owner
 * (NULL) gehören der echten Instanz, Demo-Zeilen tragen die Demo-Adresse. Der
 * X-Demo-Token-Header entscheidet, welcher Ausschnitt sichtbar ist.
 */
exports.DEMO_EMAIL = (process.env.DEMO_EMAIL || 'demo@example.com').trim().toLowerCase();
const DEMO_NAME = (process.env.DEMO_NAME || 'Max Muster').trim();
const SESSION_TTL_HOURS = Math.max(1, parseInt(process.env.DEMO_SESSION_HOURS || '720', 10) || 720);
const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS demo_users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS demo_sessions (
    token VARCHAR(128) PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES demo_users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
  );
  ALTER TABLE offers ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255);
  CREATE INDEX IF NOT EXISTS idx_offers_owner ON offers(owner_email);
  CREATE INDEX IF NOT EXISTS idx_demo_sessions_user ON demo_sessions(user_id);
`;
const DEMO_OFFERS = [
    {
        id: 'demo-herbst-morgenkreis',
        iso: '2026-09-16T07:15:00.000Z',
        title: 'Morgenkreis: Der Herbst ist da',
        topic: 'Jahreszeiten und Naturbeobachtung im Herbst',
        category: 'Morgenkreis',
        targetGroup: 'Regelgruppe (3-6 Jahre)',
        duration: '25 Minuten',
        groupSize: 18,
        isBilingual: false,
        materials: [
            { item: 'Herbstkorb mit Kastanien, Eicheln und bunten Blättern', amount: '1 Korb' },
            { item: 'Bildkarten zu Baum, Igel und Wind', amount: '6 Stück' },
            { item: 'Handpuppe „Kastanie Karl“', amount: '1' },
            { item: 'Klangoase (Klangschale)', amount: '1' },
        ],
        goals: [
            'Die Kinder benennen drei Veränderungen in der Natur im Herbst.',
            'Die Kinder nehmen bewusst ein Naturgeräusch wahr und beschreiben es.',
            'Die Kinder warten, bis sie an der Reihe sind, und hören anderen zu.',
        ],
        preparation: [
            'Herbstkorb am Vortag mit den Kindern im Garten füllen und über Nacht bereitstellen.',
            'Stuhlkreis in der Gruppe Sonnenkäfer der Kita „Regenbogen“ vorbereiten, Bildkarten nach Reihenfolge sortieren.',
            'Klangschale und Handpuppe greifbar neben den Sitzplatz legen.',
            'Für die Kleingruppenarbeit Gruppen A (Mia Berger, Ben Keller, Emma Hoffmann, Paul Weber) und B (Lena Fischer, Jonas Brandt, Clara Neumann, Niklas Roth) einteilen.',
        ],
        steps: [
            'Mit der Klangschale den Kreis eröffnen und die Kinder in Stille ankommen lassen.',
            'Kastanie Karl begrüßen und fragen, was die Kinder im Korb entdecken.',
            'Jedes Kind nimmt einen Gegenstand, beschreibt ihn und legt ihn auf das Tuch.',
            'Gemeinsam überlegen, warum die Blätter bunt werden; Bildkarten als Erzählhilfe nutzen.',
            'Mit einem Herbstlied schließen und den Korb für die Freispielphase bereitstellen.',
        ],
    },
    {
        id: 'demo-tierparcours-turnen',
        iso: '2026-10-07T08:40:00.000Z',
        title: 'Turnen: Tierparcours durch die Turnhalle',
        topic: 'Bewegungserfahrung mit Gleichgewicht und Körperspannung',
        category: 'Turnen/Bewegung',
        targetGroup: 'Regelgruppe (3-6 Jahre)',
        duration: '45 Minuten',
        groupSize: 16,
        isBilingual: false,
        materials: [
            { item: 'Turnbank', amount: '3' },
            { item: 'Bodenmatte', amount: '4' },
            { item: 'Hütchen', amount: '8' },
            { item: 'Seile für die Spinnennetze', amount: '2' },
            { item: 'Tierbilder für die Stationen', amount: '5' },
        ],
        goals: [
            'Die Kinder halten beim Balancieren das Gleichgewicht über drei Schritte.',
            'Die Kinder springen beidbeinig von einer Matte auf die nächste.',
            'Die Kinder erkennen und benennen die Bewegungsform eines Tieres.',
        ],
        preparation: [
            'Parcours in fünf Stationen aufbauen: Frosch (Matten), Schlange (Seil), Bär (Bank), Vogel (Hütchenslalom), Igel (Rolle).',
            'Turnhalle vorab lüften und Matten an den Geräten gegen Verrutschen sichern.',
            'Tierbilder an den Stationen befestigen, damit die Kinder die Aufgabe ohne Erklärung finden.',
            'Zwei Erzieherinnen einteilen: Alex Berger begleitet die Stationen 1 bis 3, Lea Hoffmann die Stationen 4 und 5.',
        ],
        steps: [
            'Im Sitzkreis die Tiere mit Bewegungen vorspielen und raten lassen.',
            'Parcours einmal gemeinsam abgehen und jede Station erklären.',
            'Kinder in zwei Gruppen aufteilen und an den Stationen starten lassen.',
            'Nach der Hälfte der Zeit die Gruppen tauschen.',
            'Im Abschlusskreis fragen, welche Station am schwierigsten war und warum.',
        ],
    },
    {
        id: 'demo-igel-basteln',
        iso: '2026-10-21T09:05:00.000Z',
        title: 'Basteln: Igel aus Kastanien und Knete',
        topic: 'Feinmotorik und Gestalten mit Naturmaterial',
        category: 'Basteln/Kunst',
        targetGroup: 'Regelgruppe (3-6 Jahre)',
        duration: '40 Minuten',
        groupSize: 14,
        isBilingual: false,
        materials: [
            { item: 'Kastanien', amount: 'pro Kind 6' },
            { item: 'Knete in Braun und Orange', amount: '1 Stück pro Kind' },
            { item: 'Streichhölzer ohne Kopf', amount: '1 Schachtel' },
            { item: 'Wackelaugen', amount: 'pro Kind 2' },
            { item: 'Kleber und Unterlage', amount: 'je 1 pro Tisch' },
        ],
        goals: [
            'Die Kinder stecken Stacheln gezielt in eine Knete-Kugel.',
            'Die Kinder benennen die Körperteile des Igels.',
            'Die Kinder räumen ihren Arbeitsplatz selbstständig auf.',
        ],
        preparation: [
            'Kastanien am Morgen waschen und trocknen, damit die Knete hält.',
            'Tische mit Wachstuch abdecken und Material in Körben bereitstellen.',
            'Für jüngere Kinder fertige Knetkugeln vorbereiten; Mia Berger und Ben Keller arbeiten mit einer vorbereiteten Kugel.',
            'Foto-Beispiel eines Igels ausdrucken und als Anschauung aufstellen.',
        ],
        steps: [
            'Einen echten Igel im Bilderbuch zeigen und über Stacheln sprechen.',
            'Knete zu einer Kugel rollen und auf die Kastanie drücken.',
            'Streichhölzer als Stacheln in die Knete stecken.',
            'Augen aufkleben und den Igel auf ein Blatt setzen.',
            'Igel auf dem Fensterbrett ausstellen und Arbeitsplatz gemeinsam aufräumen.',
        ],
    },
    {
        id: 'demo-kuerbis-experiment',
        iso: '2026-11-04T08:20:00.000Z',
        title: 'Experimente: Warum schwimmt ein Kürbis?',
        topic: 'Auftrieb und Dichte mit Herbstfrüchten',
        category: 'Experimente/MINT',
        targetGroup: 'Vorschule (5-6 Jahre)',
        duration: '30 Minuten',
        groupSize: 12,
        isBilingual: false,
        materials: [
            { item: 'Kürbis, Apfel und Kartoffel', amount: 'je 1' },
            { item: 'Durchsichtige Schüssel mit Wasser', amount: '1' },
            { item: 'Handtücher', amount: '4' },
            { item: 'Waage', amount: '1' },
            { item: 'Protokollbogen mit Bildern', amount: '12' },
        ],
        goals: [
            'Die Kinder stellen eine Vermutung auf und prüfen sie im Versuch.',
            'Die Kinder beschreiben, dass ein schwerer Kürbis trotzdem schwimmen kann.',
            'Die Kinder halten ihr Ergebnis auf dem Protokollbogen fest.',
        ],
        preparation: [
            'Schüssel auf ein Handtuch stellen und Wasser in Reichweite der Kinder füllen.',
            'Kürbis, Apfel und Kartoffel wiegen und die Gewichte auf Karten notieren.',
            'Protokollbögen mit den drei Früchten zum Ankreuzen vorbereiten.',
            'Die Vorschulgruppe Schlaufüchse in zwei Teams teilen, damit jedes Kind selbst legen darf.',
        ],
        steps: [
            'Die drei Früchte zeigen und Vermutungen mit Handzeichen abstimmen.',
            'Jedes Kind legt eine Frucht ins Wasser und beobachtet.',
            'Gewicht und Ergebnis vergleichen: Was ist schwer, was schwimmt?',
            'Gemeinsam eine einfache Erklärung finden (Luft im Kürbis).',
            'Ergebnis auf dem Protokollbogen ankreuzen und aufhängen.',
        ],
    },
    {
        id: 'demo-kamishibai-raupe',
        iso: '2026-06-09T07:50:00.000Z',
        title: 'Kamishibai: Die kleine Raupe Nimmersatt',
        topic: 'Bilderbuch erzählen mit dem Erzähltheater',
        category: 'Kamishibai',
        targetGroup: 'Krippe (0-3 Jahre)',
        duration: '20 Minuten',
        groupSize: 10,
        isBilingual: false,
        materials: [
            { item: 'Kamishibai-Rahmen', amount: '1' },
            { item: 'Bildkarten zur Raupe', amount: '8' },
            { item: 'Stoffraupe', amount: '1' },
            { item: 'Kuscheldecke für den Sitzkreis', amount: '1' },
        ],
        goals: [
            'Die Kinder folgen der Bildfolge und zeigen auf bekannte Früchte.',
            'Die Kinder machen die Fressbewegung der Raupe nach.',
            'Die Kinder erleben Ruhe und Aufmerksamkeit in der Kleingruppe.',
        ],
        preparation: [
            'Sitzkreis in der Krippengruppe Marienkäfer mit Decke vorbereiten.',
            'Bildkarten in Erzählreihenfolge hinter dem Rahmen bereitstellen.',
            'Stoffraupe versteckt unter dem Tuch, damit sie überraschend auftaucht.',
            'Auf Abstände achten, damit alle zehn Kinder freie Sicht auf den Rahmen haben.',
        ],
        steps: [
            'Mit der Stoffraupe langsam über die Decke kriechen und die Kinder begrüßen.',
            'Erste Karte zeigen: die Raupe schlüpft aus dem Ei.',
            'Karte für Karte erzählen und bei jeder Frucht kurz innehalten.',
            'Kinder die Frucht benennen und die Hand zum Mund führen lassen.',
            'Letzte Karte mit dem Schmetterling zeigen und gemeinsam summen.',
        ],
        scenes: [
            { sceneNumber: 1, storyText: 'Im Mondlicht liegt ein winziges Ei auf einem Blatt.', imagePrompt: 'Aquarell: kleines Ei auf grünem Blatt im Mondlicht, warme Farben, kindgerecht' },
            { sceneNumber: 2, storyText: 'Am Morgen schlüpft eine kleine, hungrige Raupe.', imagePrompt: 'Aquarell: kleine Raupe schlüpft aus dem Ei, weiche Farben, kindgerecht' },
            { sceneNumber: 3, storyText: 'Die Raupe frisst sich durch Apfel, Birne und Pflaume.', imagePrompt: 'Aquarell: Raupe frisst sich durch Obst, fröhlich, kindgerecht' },
            { sceneNumber: 4, storyText: 'Satt und müde baut sie sich ein Haus und wird zum Schmetterling.', imagePrompt: 'Aquarell: Raupe im Kokon und bunter Schmetterling, kindgerecht' },
        ],
    },
    {
        id: 'demo-regenmacher-musik',
        iso: '2026-04-22T09:30:00.000Z',
        title: 'Musik: Regenmacher selbst gebaut',
        topic: 'Klangerfahrung und Rhythmik mit Alltagsmaterial',
        category: 'Musik',
        targetGroup: 'Regelgruppe (3-6 Jahre)',
        duration: '35 Minuten',
        groupSize: 15,
        isBilingual: false,
        materials: [
            { item: 'Küchenrollen', amount: '15' },
            { item: 'Reis und Linsen', amount: '2 Becher' },
            { item: 'Klebeband', amount: '2 Rollen' },
            { item: 'Stifte zum Bemalen', amount: '15' },
            { item: 'Tamburin für den Takt', amount: '1' },
        ],
        goals: [
            'Die Kinder unterscheiden laute und leise Klänge.',
            'Die Kinder halten einen einfachen Rhythmus mit dem Tamburin.',
            'Die Kinder gestalten ihren Regenmacher individuell.',
        ],
        preparation: [
            'Küchenrollen an einer Seite vorab mit Klebeband verschließen.',
            'Reis und Linsen in Schüsseln bereitstellen, Trichter danebenlegen.',
            'Platz für eine freie Bewegung durch den Raum schaffen.',
            'Trommelkreis mit Stühlen in der Gruppe Sonnenkäfer vorbereiten.',
        ],
        steps: [
            'Regengeräusche vorspielen und die Kinder raten lassen.',
            'Zeigen, wie Reis in die Rolle gefüllt wird, und die Rolle verschließen.',
            'Kinder bemalen ihre Rolle und schütteln sie im Stehen.',
            'Mit dem Tamburin einen langsamen Takt vorgeben und alle fallen ein.',
            'Leise und laut unterscheiden: Handzeichen für „Regen“ und „Sturm“.',
        ],
    },
    {
        id: 'demo-grueffelo-geschichte',
        iso: '2026-02-11T08:10:00.000Z',
        title: 'Geschichte: Der Grüffelo im Erzählkreis',
        topic: 'Sprachförderung mit Bilderbüchern',
        category: 'Geschichte vorlesen',
        targetGroup: 'Krippe (0-3 Jahre)',
        duration: '25 Minuten',
        groupSize: 9,
        isBilingual: false,
        materials: [
            { item: 'Bilderbuch „Der Grüffelo“', amount: '1' },
            { item: 'Handpuppe Maus', amount: '1' },
            { item: 'Sitzkissen', amount: '9' },
        ],
        goals: [
            'Die Kinder hören einer Bilderbuchgeschichte über mehrere Seiten zu.',
            'Die Kinder zeigen auf Tiere, die im Buch vorkommen.',
            'Die Kinder sprechen Tierlaute nach.',
        ],
        preparation: [
            'Sitzkissen im Kreis der Krippengruppe Marienkäfer auslegen.',
            'Buch vorab ansehen und die Seiten zum Wiederholen markieren.',
            'Handpuppe Maus bereitlegen; rutschfeste Unterlage unter das Kissen legen.',
            'Auf ruhige Umgebung achten, Musik aus, damit die Kinder zuhören können.',
        ],
        steps: [
            'Die Maus aus der Puppe hervorholen und die Kinder begrüßen.',
            'Titelbild zeigen und fragen, wer den Grüffelo kennt.',
            'Bis zur Hälfte vorlesen und die Tiere mit Gesten begleiten.',
            'Kinder die Tierlaute nachmachen lassen.',
            'Mit der letzten Seite enden und fragen, ob die Maus mutig war.',
        ],
    },
    {
        id: 'demo-laternenfest-morgenkreis',
        iso: '2026-11-11T07:30:00.000Z',
        title: 'Morgenkreis: Laternenfest vorbereiten',
        topic: 'Gemeinschaft und Vorfreude auf das Laternenfest',
        category: 'Morgenkreis',
        targetGroup: 'Vorschule (5-6 Jahre)',
        duration: '30 Minuten',
        groupSize: 12,
        isBilingual: true,
        materials: [
            { item: 'Laternengriff aus Holz', amount: '12' },
            { item: 'Laternenlichter (LED)', amount: '12' },
            { item: 'Bildkarten zum Liedertext', amount: '6' },
            { item: 'Klangstäbe', amount: '2' },
        ],
        goals: [
            'Die Kinder singen das Laternenlied mit zwei Strophen mit.',
            'Die Kinder benennen drei Regeln für den Laternenumzug.',
            'Die Kinder erleben die Gruppe als Gemeinschaft.',
        ],
        preparation: [
            'Laternen und Lichter im Nebenraum der Kita „Regenbogen“ bereitstellen und auf Funktion prüfen.',
            'Liedertext mit Bildkarten an der Wand befestigen.',
            'Regeln für den Umzug am Flipchart skizzieren: Hand halten, leise gehen, an der Straße warten.',
            'Zweisprachige Begrüßung vorbereiten: “Good morning, let’s light our lanterns.”',
        ],
        steps: [
            'Mit Klangstäben den Kreis eröffnen und die Laternen zeigen.',
            'Das Laternenlied mit Bildkarten zweimal gemeinsam singen.',
            'Regeln am Flipchart besprechen und von Kindern wiederholen lassen.',
            'In der Turnhalle einmal im Gänsemarsch üben.',
            'Die Laternen im Flur aufhängen und den Eltern beim Abholen zeigen.',
        ],
    },
];
function offerData(seed) {
    const savedAt = Date.parse(seed.iso);
    const data = {
        id: seed.id,
        createdAt: seed.iso,
        savedAt,
        input: {
            topic: seed.topic,
            category: seed.category,
            targetGroup: seed.targetGroup,
            isBilingual: seed.isBilingual,
            groupSize: seed.groupSize,
            duration: seed.duration,
        },
        title: seed.title,
        materials: seed.materials,
        goals: seed.goals,
        preparation: seed.preparation.map((line, i) => `${i + 1}. ${line}`).join('\n'),
        steps: seed.steps.map((instruction, i) => ({ step: i + 1, instruction })),
    };
    if (seed.scenes) {
        data.kamishibaiScenes = seed.scenes;
    }
    return data;
}
let setupPromise = null;
/** Schmale Hilfe, weil `query` aus db.ts untypisierte Zeilen liefert. */
function rows(text, params) {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield (0, db_1.query)(text, params);
        return res.rows;
    });
}
/** Beispiel-Angebote idempotent anlegen/auffrischen (läuft auch bei jedem Demo-Login). */
function seedDemoOffers() {
    return __awaiter(this, void 0, void 0, function* () {
        for (const seed of DEMO_OFFERS) {
            yield (0, db_1.query)(`INSERT INTO offers (offer_id, title, created_at, owner_email, data)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (offer_id) DO UPDATE
         SET title = EXCLUDED.title, data = EXCLUDED.data,
             owner_email = EXCLUDED.owner_email`, [seed.id, seed.title, seed.iso, exports.DEMO_EMAIL, offerData(seed)]);
        }
    });
}
function runSetup() {
    return __awaiter(this, void 0, void 0, function* () {
        yield (0, db_1.query)(INIT_SQL);
        const user = yield rows(`INSERT INTO demo_users (email, display_name) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name
     RETURNING id`, [exports.DEMO_EMAIL, DEMO_NAME]);
        const userId = user[0].id;
        yield seedDemoOffers();
        const counts = yield rows(`SELECT (SELECT COUNT(*)::int FROM offers WHERE owner_email = $1) AS demos,
            (SELECT COUNT(*)::int FROM demo_users) AS users`, [exports.DEMO_EMAIL]);
        console.log(`[demo] bereit: ${counts[0].demos} Demo-Angebote, ${counts[0].users} Demo-Konto (id ${userId}, ${exports.DEMO_EMAIL}).`);
    });
}
/** Idempotent: Schema, Demo-Konto und Beispiel-Angebote anlegen. */
function ensureDemoSetup() {
    if (!setupPromise) {
        setupPromise = runSetup().catch((err) => {
            setupPromise = null;
            throw err;
        });
    }
    return setupPromise;
}
function createDemoSession() {
    return __awaiter(this, void 0, void 0, function* () {
        yield ensureDemoSetup();
        // Gelöschte Beispiel-Angebote wieder auffüllen, damit jede Demo gefüllt startet.
        yield seedDemoOffers();
        const found = yield rows('SELECT id, email, display_name FROM demo_users WHERE lower(email) = lower($1) LIMIT 1', [exports.DEMO_EMAIL]);
        const row = found[0];
        if (!row) {
            throw new Error('Demo-Konto fehlt');
        }
        const token = (0, node_crypto_1.randomBytes)(32).toString('hex');
        yield (0, db_1.query)(`INSERT INTO demo_sessions (token, user_id, expires_at)
     VALUES ($1, $2, now() + ($3 || ' hours')::interval)`, [token, row.id, String(SESSION_TTL_HOURS)]);
        // Abgelaufene Sitzungen aufräumen; gültige Sitzungen anderer Besucher bleiben bestehen.
        yield (0, db_1.query)('DELETE FROM demo_sessions WHERE expires_at < now()').catch(() => undefined);
        return { token, user: { id: row.id, email: row.email, name: row.display_name } };
    });
}
function demoUserFromRequest(req) {
    return __awaiter(this, void 0, void 0, function* () {
        const rawHeader = String(req.headers['x-demo-token'] || '').trim();
        const auth = String(req.headers.authorization || '');
        const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
        const token = rawHeader || bearer;
        if (!token || token.length > 128)
            return null;
        try {
            const found = yield rows(`SELECT u.id, u.email, u.display_name
         FROM demo_sessions s
         JOIN demo_users u ON u.id = s.user_id
        WHERE s.token = $1 AND s.expires_at > now()
        LIMIT 1`, [token]);
            const row = found[0];
            return row ? { id: row.id, email: row.email, name: row.display_name } : null;
        }
        catch (err) {
            console.error('[demo] Session-Prüfung fehlgeschlagen:', err);
            return null;
        }
    });
}
/** E-Mail des Demo-Kontos, wenn der Request einen gültigen Demo-Token trägt. */
function demoScopeEmail(req) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield demoUserFromRequest(req);
        return user ? user.email : null;
    });
}
