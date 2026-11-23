/** Continent codes: Europe, Asia, Africa, North America, South America, Oceania. */
export type Continent = 'eu' | 'as' | 'af' | 'na' | 'sa' | 'oc';

export interface Country {
  /** ISO 3166-1 alpha-2, lower case (also the SVG file name in ./svg) */
  code: string;
  en: string;
  sk: string;
  continent: Continent;
}

// [code, English, Slovak]
type Row = [string, string, string];

const EU: Row[] = [
  ['al', 'Albania', 'Albánsko'], ['ad', 'Andorra', 'Andorra'], ['at', 'Austria', 'Rakúsko'],
  ['by', 'Belarus', 'Bielorusko'], ['be', 'Belgium', 'Belgicko'], ['ba', 'Bosnia and Herzegovina', 'Bosna a Hercegovina'],
  ['bg', 'Bulgaria', 'Bulharsko'], ['hr', 'Croatia', 'Chorvátsko'], ['cy', 'Cyprus', 'Cyprus'],
  ['cz', 'Czechia', 'Česko'], ['dk', 'Denmark', 'Dánsko'], ['ee', 'Estonia', 'Estónsko'],
  ['fi', 'Finland', 'Fínsko'], ['fr', 'France', 'Francúzsko'], ['de', 'Germany', 'Nemecko'],
  ['gr', 'Greece', 'Grécko'], ['hu', 'Hungary', 'Maďarsko'], ['is', 'Iceland', 'Island'],
  ['ie', 'Ireland', 'Írsko'], ['it', 'Italy', 'Taliansko'], ['xk', 'Kosovo', 'Kosovo'],
  ['lv', 'Latvia', 'Lotyšsko'], ['li', 'Liechtenstein', 'Lichtenštajnsko'], ['lt', 'Lithuania', 'Litva'],
  ['lu', 'Luxembourg', 'Luxembursko'], ['mt', 'Malta', 'Malta'], ['md', 'Moldova', 'Moldavsko'],
  ['mc', 'Monaco', 'Monako'], ['me', 'Montenegro', 'Čierna Hora'], ['nl', 'Netherlands', 'Holandsko'],
  ['mk', 'North Macedonia', 'Severné Macedónsko'], ['no', 'Norway', 'Nórsko'], ['pl', 'Poland', 'Poľsko'],
  ['pt', 'Portugal', 'Portugalsko'], ['ro', 'Romania', 'Rumunsko'], ['ru', 'Russia', 'Rusko'],
  ['sm', 'San Marino', 'San Maríno'], ['rs', 'Serbia', 'Srbsko'], ['sk', 'Slovakia', 'Slovensko'],
  ['si', 'Slovenia', 'Slovinsko'], ['es', 'Spain', 'Španielsko'], ['se', 'Sweden', 'Švédsko'],
  ['ch', 'Switzerland', 'Švajčiarsko'], ['ua', 'Ukraine', 'Ukrajina'], ['gb', 'United Kingdom', 'Veľká Británia'],
  ['va', 'Vatican City', 'Vatikán'],
];

const AS: Row[] = [
  ['af', 'Afghanistan', 'Afganistan'], ['am', 'Armenia', 'Arménsko'], ['az', 'Azerbaijan', 'Azerbajdžan'],
  ['bh', 'Bahrain', 'Bahrajn'], ['bd', 'Bangladesh', 'Bangladéš'], ['bt', 'Bhutan', 'Bhután'],
  ['bn', 'Brunei', 'Brunej'], ['kh', 'Cambodia', 'Kambodža'], ['cn', 'China', 'Čína'],
  ['ge', 'Georgia', 'Gruzínsko'], ['in', 'India', 'India'], ['id', 'Indonesia', 'Indonézia'],
  ['ir', 'Iran', 'Irán'], ['iq', 'Iraq', 'Irak'], ['il', 'Israel', 'Izrael'],
  ['jp', 'Japan', 'Japonsko'], ['jo', 'Jordan', 'Jordánsko'], ['kz', 'Kazakhstan', 'Kazachstan'],
  ['kw', 'Kuwait', 'Kuvajt'], ['kg', 'Kyrgyzstan', 'Kirgizsko'], ['la', 'Laos', 'Laos'],
  ['lb', 'Lebanon', 'Libanon'], ['my', 'Malaysia', 'Malajzia'], ['mv', 'Maldives', 'Maldivy'],
  ['mn', 'Mongolia', 'Mongolsko'], ['mm', 'Myanmar', 'Mjanmarsko'], ['np', 'Nepal', 'Nepál'],
  ['kp', 'North Korea', 'Severná Kórea'], ['om', 'Oman', 'Omán'], ['pk', 'Pakistan', 'Pakistan'],
  ['ph', 'Philippines', 'Filipíny'], ['qa', 'Qatar', 'Katar'], ['sa', 'Saudi Arabia', 'Saudská Arábia'],
  ['sg', 'Singapore', 'Singapur'], ['kr', 'South Korea', 'Južná Kórea'], ['lk', 'Sri Lanka', 'Srí Lanka'],
  ['sy', 'Syria', 'Sýria'], ['tj', 'Tajikistan', 'Tadžikistan'], ['th', 'Thailand', 'Thajsko'],
  ['tl', 'Timor-Leste', 'Východný Timor'], ['tr', 'Turkey', 'Turecko'], ['tm', 'Turkmenistan', 'Turkménsko'],
  ['ae', 'United Arab Emirates', 'Spojené arabské emiráty'], ['uz', 'Uzbekistan', 'Uzbekistan'],
  ['vn', 'Vietnam', 'Vietnam'], ['ye', 'Yemen', 'Jemen'],
];

const AF: Row[] = [
  ['dz', 'Algeria', 'Alžírsko'], ['ao', 'Angola', 'Angola'], ['bj', 'Benin', 'Benin'],
  ['bw', 'Botswana', 'Botswana'], ['bf', 'Burkina Faso', 'Burkina Faso'], ['bi', 'Burundi', 'Burundi'],
  ['cv', 'Cape Verde', 'Kapverdy'], ['cm', 'Cameroon', 'Kamerun'], ['cf', 'Central African Republic', 'Stredoafrická republika'],
  ['td', 'Chad', 'Čad'], ['km', 'Comoros', 'Komory'], ['cg', 'Congo', 'Kongo'],
  ['cd', 'DR Congo', 'Kongo (KDR)'], ['ci', 'Ivory Coast', 'Pobrežie Slonoviny'], ['dj', 'Djibouti', 'Džibutsko'],
  ['eg', 'Egypt', 'Egypt'], ['gq', 'Equatorial Guinea', 'Rovníková Guinea'], ['er', 'Eritrea', 'Eritrea'],
  ['sz', 'Eswatini', 'Eswatini'], ['et', 'Ethiopia', 'Etiópia'], ['ga', 'Gabon', 'Gabon'],
  ['gm', 'Gambia', 'Gambia'], ['gh', 'Ghana', 'Ghana'], ['gn', 'Guinea', 'Guinea'],
  ['gw', 'Guinea-Bissau', 'Guinea-Bissau'], ['ke', 'Kenya', 'Keňa'], ['ls', 'Lesotho', 'Lesotho'],
  ['lr', 'Liberia', 'Libéria'], ['ly', 'Libya', 'Líbya'], ['mg', 'Madagascar', 'Madagaskar'],
  ['mw', 'Malawi', 'Malawi'], ['ml', 'Mali', 'Mali'], ['mr', 'Mauritania', 'Mauritánia'],
  ['mu', 'Mauritius', 'Maurícius'], ['ma', 'Morocco', 'Maroko'], ['mz', 'Mozambique', 'Mozambik'],
  ['na', 'Namibia', 'Namíbia'], ['ne', 'Niger', 'Niger'], ['ng', 'Nigeria', 'Nigéria'],
  ['rw', 'Rwanda', 'Rwanda'], ['st', 'São Tomé and Príncipe', 'Svätý Tomáš a Princov ostrov'], ['sn', 'Senegal', 'Senegal'],
  ['sc', 'Seychelles', 'Seychely'], ['sl', 'Sierra Leone', 'Sierra Leone'], ['so', 'Somalia', 'Somálsko'],
  ['za', 'South Africa', 'Južná Afrika'], ['ss', 'South Sudan', 'Južný Sudán'], ['sd', 'Sudan', 'Sudán'],
  ['tz', 'Tanzania', 'Tanzánia'], ['tg', 'Togo', 'Togo'], ['tn', 'Tunisia', 'Tunisko'],
  ['ug', 'Uganda', 'Uganda'], ['zm', 'Zambia', 'Zambia'], ['zw', 'Zimbabwe', 'Zimbabwe'],
];

const NA: Row[] = [
  ['ag', 'Antigua and Barbuda', 'Antigua a Barbuda'], ['bs', 'Bahamas', 'Bahamy'], ['bb', 'Barbados', 'Barbados'],
  ['bz', 'Belize', 'Belize'], ['ca', 'Canada', 'Kanada'], ['cr', 'Costa Rica', 'Kostarika'],
  ['cu', 'Cuba', 'Kuba'], ['dm', 'Dominica', 'Dominika'], ['do', 'Dominican Republic', 'Dominikánska republika'],
  ['sv', 'El Salvador', 'Salvádor'], ['gd', 'Grenada', 'Grenada'], ['gt', 'Guatemala', 'Guatemala'],
  ['ht', 'Haiti', 'Haiti'], ['hn', 'Honduras', 'Honduras'], ['jm', 'Jamaica', 'Jamajka'],
  ['mx', 'Mexico', 'Mexiko'], ['ni', 'Nicaragua', 'Nikaragua'], ['pa', 'Panama', 'Panama'],
  ['kn', 'Saint Kitts and Nevis', 'Svätý Krištof a Nevis'], ['lc', 'Saint Lucia', 'Svätá Lucia'],
  ['vc', 'Saint Vincent and the Grenadines', 'Svätý Vincent a Grenadíny'], ['tt', 'Trinidad and Tobago', 'Trinidad a Tobago'],
  ['us', 'United States', 'Spojené štáty'],
];

const SA: Row[] = [
  ['ar', 'Argentina', 'Argentína'], ['bo', 'Bolivia', 'Bolívia'], ['br', 'Brazil', 'Brazília'],
  ['cl', 'Chile', 'Čile'], ['co', 'Colombia', 'Kolumbia'], ['ec', 'Ecuador', 'Ekvádor'],
  ['gy', 'Guyana', 'Guyana'], ['py', 'Paraguay', 'Paraguaj'], ['pe', 'Peru', 'Peru'],
  ['sr', 'Suriname', 'Surinam'], ['uy', 'Uruguay', 'Uruguaj'], ['ve', 'Venezuela', 'Venezuela'],
];

const OC: Row[] = [
  ['au', 'Australia', 'Austrália'], ['fj', 'Fiji', 'Fidži'], ['ki', 'Kiribati', 'Kiribati'],
  ['mh', 'Marshall Islands', 'Marshallove ostrovy'], ['fm', 'Micronesia', 'Mikronézia'], ['nr', 'Nauru', 'Nauru'],
  ['nz', 'New Zealand', 'Nový Zéland'], ['pw', 'Palau', 'Palau'], ['pg', 'Papua New Guinea', 'Papua-Nová Guinea'],
  ['ws', 'Samoa', 'Samoa'], ['sb', 'Solomon Islands', 'Šalamúnove ostrovy'], ['to', 'Tonga', 'Tonga'],
  ['tv', 'Tuvalu', 'Tuvalu'], ['vu', 'Vanuatu', 'Vanuatu'],
];

const rows = (list: Row[], continent: Continent): Country[] =>
  list.map(([code, en, sk]) => ({ code, en, sk, continent }));

export const COUNTRIES: Country[] = [
  ...rows(EU, 'eu'), ...rows(AS, 'as'), ...rows(AF, 'af'),
  ...rows(NA, 'na'), ...rows(SA, 'sa'), ...rows(OC, 'oc'),
];

/** Well-known countries with recognisable flags (pool for the medium level). */
export const FAMOUS = new Set([
  'gb', 'fr', 'de', 'it', 'es', 'pt', 'nl', 'be', 'ch', 'at', 'pl', 'cz', 'sk', 'hu', 'ua', 'ru',
  'gr', 'se', 'no', 'dk', 'fi', 'ie', 'hr', 'tr',
  'us', 'ca', 'mx', 'cu', 'jm', 'br', 'ar', 'cl', 'co', 'pe',
  'cn', 'jp', 'kr', 'in', 'id', 'th', 'vn', 'ph', 'sa', 'il', 'pk', 'np', 'sg', 'kz', 'mn',
  'eg', 'za', 'ng', 'ke', 'ma', 'gh', 'et', 'dz',
  'au', 'nz',
]);

/** Groups of flags that are easy to mix up. Hard level uses them as distractors; easy avoids them. */
const LOOKALIKES: string[][] = [
  ['ro', 'td', 'md', 'ad', 'be'],
  ['id', 'mc', 'pl', 'sg', 'at'],
  ['nl', 'lu', 'ru', 'fr', 'hr', 'py'],
  ['ru', 'sk', 'si', 'rs', 'hr'],
  ['it', 'mx', 'ie', 'ci', 'hu', 'ne', 'in'],
  ['au', 'nz', 'gb', 'fj', 'tv'],
  ['no', 'is', 'dk', 'se', 'fi', 'ch'],
  ['be', 'de', 'ug'],
  ['hu', 'bg', 'tj', 'ir', 'lt'],
  ['lt', 'bo', 'gh', 'et', 'cm', 'sn', 'ml', 'gn', 'gw'],
  ['co', 'ec', 've', 'am'],
  ['ye', 'eg', 'sy', 'iq', 'sd', 'ae', 'kw', 'jo'],
  ['hn', 'ni', 'sv', 'gt', 'ar', 'uy', 'bw'],
  ['cz', 'ph', 'cu', 'pr', 'cl', 'bs', 'tl'],
  ['qa', 'bh', 'lv'],
  ['jp', 'bd', 'pw', 'kr', 'lk'],
  ['cn', 'vn', 'kp', 'mm', 'tr', 'tn'],
  ['us', 'lr', 'my', 'pr'],
  ['gr', 'uy', 'il', 'fi'],
  ['cr', 'th', 'kp'],
  ['pe', 'ca', 'lb', 'at', 'lv', 'dk'],
  ['dz', 'pk', 'mr', 'tm', 'sa'],
  ['ga', 'sl', 'rw', 'tz', 'ss', 'ke', 'mw'],
  ['zw', 'zm', 'za', 'mz', 'ao'],
  ['ee', 'bw', 'sl'],
  ['si', 'sk', 'ba', 'xk', 'cy'],
];

const LOOK = new Map<string, Set<string>>();
for (const group of LOOKALIKES) {
  for (const a of group) {
    if (!LOOK.has(a)) LOOK.set(a, new Set());
    for (const b of group) if (b !== a) LOOK.get(a)!.add(b);
  }
}
export const lookalikes = (code: string): Set<string> => LOOK.get(code) ?? new Set();

const urls = import.meta.glob<string>('./svg/*.svg', { query: '?url', import: 'default', eager: true });
export const flagUrl = (code: string): string => urls[`./svg/${code}.svg`];
