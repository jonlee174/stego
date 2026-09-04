import type { DinoName, Palette } from '../state/theme';
import { usePalette } from '../state/theme';

/**
 * Every dinosaur exists once per palette, generated from the source drawings by
 * `tools/recolour-dinos.mjs`. Recolouring ahead of time rather than at runtime
 * keeps the shading and the black outlines intact, which a CSS filter or mask
 * could not do.
 *
 * `stegosaurus-green` is the original artwork, copied rather than regenerated.
 */
import stegosaurusGreen from '../../assets/images/themed/stegosaurus-green.png';
import stegosaurusRed from '../../assets/images/themed/stegosaurus-red.png';
import stegosaurusBlue from '../../assets/images/themed/stegosaurus-blue.png';
import stegosaurusPurple from '../../assets/images/themed/stegosaurus-purple.png';
import stegosaurusPink from '../../assets/images/themed/stegosaurus-pink.png';

import velociraptorGreen from '../../assets/images/themed/velociraptor-green.png';
import velociraptorRed from '../../assets/images/themed/velociraptor-red.png';
import velociraptorBlue from '../../assets/images/themed/velociraptor-blue.png';
import velociraptorPurple from '../../assets/images/themed/velociraptor-purple.png';
import velociraptorPink from '../../assets/images/themed/velociraptor-pink.png';

import brachiosaurusGreen from '../../assets/images/themed/brachiosaurus-green.png';
import brachiosaurusRed from '../../assets/images/themed/brachiosaurus-red.png';
import brachiosaurusBlue from '../../assets/images/themed/brachiosaurus-blue.png';
import brachiosaurusPurple from '../../assets/images/themed/brachiosaurus-purple.png';
import brachiosaurusPink from '../../assets/images/themed/brachiosaurus-pink.png';

import tyrannosaurusGreen from '../../assets/images/themed/tyrannosaurus-green.png';
import tyrannosaurusRed from '../../assets/images/themed/tyrannosaurus-red.png';
import tyrannosaurusBlue from '../../assets/images/themed/tyrannosaurus-blue.png';
import tyrannosaurusPurple from '../../assets/images/themed/tyrannosaurus-purple.png';
import tyrannosaurusPink from '../../assets/images/themed/tyrannosaurus-pink.png';

import triceratopsGreen from '../../assets/images/themed/triceratops-green.png';
import triceratopsRed from '../../assets/images/themed/triceratops-red.png';
import triceratopsBlue from '../../assets/images/themed/triceratops-blue.png';
import triceratopsPurple from '../../assets/images/themed/triceratops-purple.png';
import triceratopsPink from '../../assets/images/themed/triceratops-pink.png';

const ART: Record<DinoName, Record<Palette, string>> = {
  stegosaurus: {
    green: stegosaurusGreen,
    red: stegosaurusRed,
    blue: stegosaurusBlue,
    purple: stegosaurusPurple,
    pink: stegosaurusPink,
  },
  velociraptor: {
    green: velociraptorGreen,
    red: velociraptorRed,
    blue: velociraptorBlue,
    purple: velociraptorPurple,
    pink: velociraptorPink,
  },
  brachiosaurus: {
    green: brachiosaurusGreen,
    red: brachiosaurusRed,
    blue: brachiosaurusBlue,
    purple: brachiosaurusPurple,
    pink: brachiosaurusPink,
  },
  tyrannosaurus: {
    green: tyrannosaurusGreen,
    red: tyrannosaurusRed,
    blue: tyrannosaurusBlue,
    purple: tyrannosaurusPurple,
    pink: tyrannosaurusPink,
  },
  triceratops: {
    green: triceratopsGreen,
    red: triceratopsRed,
    blue: triceratopsBlue,
    purple: triceratopsPurple,
    pink: triceratopsPink,
  },
};

/** The artwork for one dinosaur in one colour. */
function dinoArt(name: DinoName, palette: Palette): string {
  return ART[name]?.[palette] ?? ART.stegosaurus.green;
}

/**
 * A dinosaur in a colour you name. The settings picker uses this to show every
 * animal in the same neutral colour, so that choice is only about the shape.
 */
export function Dino({
  name,
  palette,
  className,
}: {
  name: DinoName;
  palette: Palette;
  className?: string;
}) {
  return <img className={className} src={dinoArt(name, palette)} alt="" />;
}

/** The mascot, in whichever colour the app is currently wearing. */
export function Mascot({ name, className }: { name: DinoName; className?: string }) {
  const [palette] = usePalette();
  return <img className={className} src={dinoArt(name, palette)} alt="" />;
}
