import { makeId } from '../lib/random';
import type { Deck } from '../types';

const PAIRS: [string, string][] = [
  ['Stegosaurus', 'Late Jurassic plant-eater with two rows of back plates'],
  ['Tyrannosaurus rex', 'Late Cretaceous predator with a bite force near 35,000 newtons'],
  ['Triceratops', 'Three-horned ceratopsian with a large bony frill'],
  ['Velociraptor', 'Turkey-sized feathered dromaeosaur with a sickle claw'],
  ['Brachiosaurus', 'Long-necked sauropod whose front legs were longer than its back legs'],
  ['Ankylosaurus', 'Armored dinosaur with a bony club at the end of its tail'],
  ['Pteranodon', 'Flying reptile — a pterosaur, not actually a dinosaur'],
  ['Archaeopteryx', 'Feathered Jurassic link between dinosaurs and birds'],
  ['Paleontology', 'The study of life from past geological periods through fossils'],
  ['Mesozoic Era', 'The age of dinosaurs: Triassic, Jurassic, and Cretaceous'],
  ['Thagomizer', 'The spiked tail tip of a stegosaurus'],
  ['Coprolite', 'Fossilized dung'],
];

/** Seeded on first launch so a new install is never a blank screen. */
export function starterDeck(): Deck {
  const now = Date.now();
  return {
    id: makeId('deck'),
    name: 'Dinosaur Basics',
    description: 'A starter deck to try out studying and testing. Edit or delete it any time.',
    createdAt: now,
    updatedAt: now,
    cards: PAIRS.map(([front, back]) => ({ id: makeId('card'), front, back })),
  };
}
