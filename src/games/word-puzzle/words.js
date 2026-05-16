const DAILY_RAW = `
about above abuse actor acute admit adopt adult after again
agent agree ahead alarm album alert alien align alike alive
allow alone along alter amber amend angel anger angle ankle
apart apple apply arena argue arise armed array arrow aside
asked asset audio audit avoid await awake award aware baked
baker basic basin basis batch bathe beach beard beast began
begin begun being below bench berry birth black blame blank
blast blaze blend bless blind block blood bloom blown blunt
blush board boast bonus boost booth bound brain brake brand
brass brave bread break breed brick brief bring brink broad
broke brown brush buddy build built bunch burst cabin cable
candy carry carve catch cause cease chain chair chalk chant
cheap cheat check cheer chess chest chick chief child chime
china chips choke chose chunk cigar civic civil claim clamp
clash clasp class clean clear clerk click cliff climb cling
clock clone close cloth cloud clown coach coast color comet
comic could count court cover crack craft crane crash crate
crawl crazy cream creed creek crept crest crime crisp cross
crowd crown crude cruel crumb crush crust cubic curse curve
cycle daily dance debit debut decay delay delta dense depth
derby devil diary digit dirty disco ditch diver dizzy donor
doubt dough dozen draft drain drama drank drape drawn dread
dream dress dried drift drink drive drone drown drunk dwarf
eagle early earth eaten ebony eight elbow elder elect elite
empty enact ended enemy enjoy enter entry equal equip erase
error essay event every exact excel exile exist extra fable
facts fairy faith false fancy fault favor feast fence fever
fewer fiber field fifth fifty fight final finer first fixed
flame flash flask flesh flick float flock flood floor flora
flour fluid flung flush flute focus foggy force forge forms
forty forum found frame fraud freak fresh fried frill front
frost frown fruit fully funny gauge ghost giant given glaze
glide globe glory glove gnome grace grade grain grand grant
grape graph grasp grass grave gravy great greed green greet
grief grill grime grind groan gross group grove grown gruff
guard guess guest guide guild guilt habit hairy handy harsh
haste hatch haunt heard heart heavy hedge hello hippy hobby
hoist homes honey honor horde horse hotel hound house hover
human humid humor hunch hurry hyena ideal igloo image imply
index inner input ivory jelly jewel joint joker joust judge
`

const EXTRA_VALID_RAW = `
adieu arose ratio raise teary scale slate crane stare adore
rebut sissy humph awake blush focal evade naval serve heath
dwarf model karma stink grade quiet bench thank piano salve
amaze apple flair worry shawl pluck snare scoff naval blare
trace clout flint poise yacht stand grand slosh mossy whoop
twang baste sissy tract piety stout flank prize forge dwarf
plumb taper waxen tonic suing relax peach plead onset hoard
risky mossy beard awoke sandy plait gloat plumb teach lower
gloom angst leech finer waxen elope pesto plain prick swirl
ranks adorn loyal frown ought taunt nasal scorn pesto thumb
saute carve roast spend amaze juice spunk plumb prude moose
greet vague creak sneer alert mound ozone polka cigar gripe
worry adept blunt amber tweak fluff brisk feast smith forth
voice trash plait reign sworn caste glory eagle elbow ruler
chord knelt droll cigar feast slosh thump retro mound bask
stove drape spurt spurn ducky sport stand sweep treat tweak
poles smith owner sleek sting plead trash plies oaken adobe
nadir worth lithe blunt thigh shake plead twirl fancy adept
peony grunt heave teary aloud crook scoff plumb feast sigma
posit groan ulcer prize aimed banjo blimp clung gypsy iliac
chess audio piano poker react relay rusty saber sable sappy
swung tying lying yacht youth zonal zebra zesty wired loner
roast aroma plane chant aside scary serum tally chunk creep
forge ditch viral viola yield yowls weary axion fizzy gobby
`

import validGuessesRaw from './valid-guesses.txt?raw'

function toList(raw) {
  return raw
    .split(/\s+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length === 5 && /^[a-z]+$/.test(s))
}

export const DAILY_WORDS = Array.from(new Set(toList(DAILY_RAW)))

export const VALID_GUESSES = new Set([
  ...DAILY_WORDS,
  ...toList(EXTRA_VALID_RAW),
  ...toList(validGuessesRaw),
])

export function isValidGuess(word, length = 5) {
  const w = word.toLowerCase()
  if (w.length !== length) return false
  if (length === 5) return VALID_GUESSES.has(w)
  const dict = DICT_CACHE.get(length)
  return dict ? dict.has(w) : false
}

const DICT_CACHE = new Map()
DICT_CACHE.set(5, VALID_GUESSES)

export async function loadDictionary(length) {
  if (DICT_CACHE.has(length)) return DICT_CACHE.get(length)
  let raw
  if (length === 4) {
    raw = (await import('./valid-guesses-4.txt?raw')).default
  } else if (length === 6) {
    raw = (await import('./valid-guesses-6.txt?raw')).default
  } else {
    throw new Error(`No dictionary for length ${length}`)
  }
  const set = new Set(
    raw
      .split(/\s+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length === length && /^[a-z]+$/.test(s)),
  )
  DICT_CACHE.set(length, set)
  return set
}

export function getRandomWord(length) {
  const dict = DICT_CACHE.get(length)
  if (!dict || dict.size === 0) return null
  if (length === 5) {
    // Use curated common pool for nicer free-play experience
    return DAILY_WORDS[Math.floor(Math.random() * DAILY_WORDS.length)]
  }
  const arr = Array.from(dict)
  return arr[Math.floor(Math.random() * arr.length)]
}

export function epochDayUTC(d = new Date()) {
  return Math.floor(d.getTime() / 86400000)
}

export function getDailyWord(d = new Date()) {
  const day = epochDayUTC(d)
  return DAILY_WORDS[day % DAILY_WORDS.length]
}

export function getDailyDateKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}
