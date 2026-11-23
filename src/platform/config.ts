// Branding and all platform texts live here.
import { pickLang } from './i18n';
import { pick } from './util';

export const APP = { name: 'sovy', tld: '.sk' };
export const MASCOT_NAME = 'Huhu';

const en = {
  tagline: 'Games for clever minds',
  /** Home-page headline; `highlight` is drawn in the brand colour. */
  slogan: { before: 'Be as wise as ', highlight: 'owls', after: '!' },
  intro: 'A box of educational mini-games for every curious kid. Puzzles, numbers, clocks and more — play, explore and grow your brain!',
  greetings: [
    `Hoo-hoo! I'm ${MASCOT_NAME} the owl. Pick a game and let's play!`,
    'Hello, friend! Which game today?',
    'Yay, you are here! Ready to train your brain?',
  ],
  levelHints: ['How tricky should it be? You choose!', 'Start easy, then try a harder level!'],
  /** Said when a kid taps the owl. */
  pokes: [
    'Hee hee, that tickles!',
    'Did you know? Owls can turn their heads almost all the way around!',
    'Hoo-hoo! I love puzzles!',
    'Mistakes help our brains grow!',
    'Did you know? An octopus has three hearts!',
    'You are doing great!',
    'Did you know? A group of owls is called a parliament!',
    'High five! ✋',
  ],
  praise: ['Great job!', 'Yes! Correct!', 'Super!', 'You got it!', 'Brilliant!', 'Wow, well done!', 'Fantastic!'],
  resultTitles: {
    3: ['Amazing! You are a superstar!', `Perfect! ${MASCOT_NAME} is so proud!`, 'WOW! Three stars!'],
    2: ['Great work!', 'Really good! Can you get 3 stars?'],
    1: ['You did it!', 'Well done! Practice makes perfect!'],
    0: ['Good try!'],
  } as Record<number, string[]>,
  resultCheer3: 'You are a star! ⭐',
  resultCheer: 'Yay! Play again?',
  levelNames: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },
  ui: {
    home: 'Home',
    back: 'Back',
    settings: 'Settings',
    fullscreen: 'Full screen',
    language: 'Language',
    sound: 'Sound',
    on: 'On',
    off: 'Off',
    close: 'Done',
    playAgain: 'Play again',
    levels: 'Levels',
    restartNote: 'Changing the language starts the game again.',
  },
};

const sk: typeof en = {
  tagline: 'Hry pre bystré hlavičky',
  slogan: { before: 'Buďte múdri ako ', highlight: 'sovy', after: '!' },
  intro: 'Súbor edukatívnych minihier pre všetky zvedavé deti. Hádanky, počty, hodiny a ešte viac — hraj sa, objavuj a trénuj hlavičku!',
  greetings: [
    `Hú-hú! Ja som sovička ${MASCOT_NAME}. Vyber si hru a poďme sa hrať!`,
    'Ahoj! Akú hru si dnes zahráme?',
    'Hurá, si tu! Poďme potrénovať hlavičku!',
  ],
  levelHints: ['Aké ťažké to má byť? Vyber si!', 'Začni ľahkou úrovňou a potom skús ťažšiu!'],
  pokes: [
    'Hi-hi, to štekí!',
    'Vieš, že sova dokáže otočiť hlavu skoro úplne dokola?',
    'Hú-hú! Milujem hádanky!',
    'Chyby pomáhajú mozgu rásť!',
    'Vieš, že chobotnica má tri srdcia?',
    'Ide ti to skvele!',
    'Vieš, že sovy vidia v tme oveľa lepšie ako ľudia?',
    'Plácnime si! ✋',
  ],
  praise: ['Výborne!', 'Áno, správne!', 'Super!', 'Máš to!', 'Skvelé!', 'Paráda!', 'Fantastické!'],
  resultTitles: {
    3: ['Úžasné! Si superhviezda!', `Perfektné! ${MASCOT_NAME} je na teba hrdá!`, 'WOW! Tri hviezdičky!'],
    2: ['Skvelá práca!', 'Veľmi dobre! Zvládneš aj tri hviezdičky?'],
    1: ['Hotovo! Dobrá práca!', 'Cvičenie robí majstra!'],
    0: ['Dobrý pokus!'],
  },
  resultCheer3: 'Si hviezda! ⭐',
  resultCheer: 'Hurá! Ešte raz?',
  levelNames: { easy: 'Ľahká', medium: 'Stredná', hard: 'Ťažká' },
  ui: {
    home: 'Domov',
    back: 'Späť',
    settings: 'Nastavenia',
    fullscreen: 'Celá obrazovka',
    language: 'Jazyk',
    sound: 'Zvuk',
    on: 'Zapnutý',
    off: 'Vypnutý',
    close: 'Hotovo',
    playAgain: 'Hrať znova',
    levels: 'Úrovne',
    restartNote: 'Po zmene jazyka sa hra spustí od začiatku.',
  },
};

/** Platform texts in the current language. */
export const T = () => pickLang({ en, sk });

/** A random praise phrase in the current language — handy for games. */
export const praise = (): string => pick(T().praise);
