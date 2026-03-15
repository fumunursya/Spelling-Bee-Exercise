import type { SpellingItem } from './types';

export type SpellingBankLoader = () => Promise<{ default: SpellingItem[] }>;

const topicBathroom = () => import('./bathroom');
const topicBodyParts = () => import('./body-parts');
const topicClothes = () => import('./clothes');
const topicColor = () => import('./color');
const topicDailyRoutines = () => import('./daily-routines');
const topicDrinks = () => import('./drinks');
const topicEducation = () => import('./education');
const topicElectronics = () => import('./electronics');
const topicEntertainmentMedia = () => import('./entertainment-media');
const topicFamily = () => import('./family');
const topicFeelings = () => import('./feelings');
const topicFood = () => import('./food');
const topicFruit = () => import('./fruit');
const topicGames = () => import('./games');
const topicHobbiesInterests = () => import('./hobbies-interests');
const topicHome = () => import('./home');
const topicKitchen = () => import('./kitchen');
const topicNumber = () => import('./number');
const topicOrdinalNumber = () => import('./ordinal-number');
const topicPersonalInformation = () => import('./personal-information');
const topicPhysicalAppearance = () => import('./physical-appearance');
const topicPlaces = () => import('./places');
const topicSchool = () => import('./school');
const topicShapes = () => import('./shapes');
const topicShopping = () => import('./shopping');
const topicSize = () => import('./size');
const topicSocialMedia = () => import('./social-media');
const topicSports = () => import('./sports');
const topicTaste = () => import('./taste');
const topicTimeDate = () => import('./time-date');
const topicTransport = () => import('./transport');
const topicVegetables = () => import('./vegetables');
const topicWeather = () => import('./weather');

export const SPELLING_BANK_LOADERS: Record<string, SpellingBankLoader> = {
  bathroom: topicBathroom,
  'body-parts': topicBodyParts,
  clothes: topicClothes,
  color: topicColor,
  'daily-routines': topicDailyRoutines,
  drinks: topicDrinks,
  education: topicEducation,
  electronics: topicElectronics,
  'entertainment-media': topicEntertainmentMedia,
  family: topicFamily,
  feelings: topicFeelings,
  food: topicFood,
  fruit: topicFruit,
  games: topicGames,
  'hobbies-interests': topicHobbiesInterests,
  home: topicHome,
  kitchen: topicKitchen,
  number: topicNumber,
  'ordinal-number': topicOrdinalNumber,
  'personal-information': topicPersonalInformation,
  'physical-appearance': topicPhysicalAppearance,
  places: topicPlaces,
  school: topicSchool,
  shapes: topicShapes,
  shopping: topicShopping,
  size: topicSize,
  'social-media': topicSocialMedia,
  sports: topicSports,
  taste: topicTaste,
  'time-date': topicTimeDate,
  transport: topicTransport,
  vegetables: topicVegetables,
  weather: topicWeather,
};
