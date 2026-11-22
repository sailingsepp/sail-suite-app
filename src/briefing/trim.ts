import { nf } from '@/core/time';
import { MAST_FACTOR, STEEP_SEA } from '@/core/polar';
import type { Ablegezeit, Sprache } from '@/core/types';
import { twaBand } from './course';
import { windBand } from './wind';

const VPP_FLACH_MASTHOEHE = 14;
const FLACH_AB = VPP_FLACH_MASTHOEHE / MAST_FACTOR;
const STURM_AB = 28;

export function describeTrimm(b: Ablegezeit, sprache: Sprache = 'de'): string | null {

  if (b.motorShare > 0.7) return null;
  if (b.maxWind < 4) return null;

  if (b.maxWind >= STURM_AB) {
    if (sprache === 'en') {
      return "At this strength it is no longer about sail draft, only about taking load off the rig. "
        + ' Fine trim is now subordinate to getting the reef stage right.';
    }
    return 'Bei diesem Druck geht es nicht mehr um Profiltiefe, sondern nur noch darum, Druck aus dem'
      + ' Rigg zu nehmen. Feintrimm ist jetzt zweitrangig gegenüber der richtigen Reffstufe.';
  }

  if (sprache === 'en') return describeTrimmEn(b);

  const T: string[] = [];
  const t = twaBand(b.avgTwa);
  const leicht = windBand(b.maxWind).i <= 2;
  const flach = b.maxWind >= FLACH_AB;

  const abpowern = flach || b.maxGust >= FLACH_AB;

  if (t >= 5) {
    T.push('Sobald der Baum weiter draußen steht, als die Travellerschiene reicht, übernimmt der'
      + ' Baumniederholer die Achterliekspannung: Ohne ihn steigt der Baum, das obere Drittel des'
      + ' Großsegels verwindet sich weg und schiebt nicht mehr.');
    T.push('Das Profil darf auf diesem Kurs rund stehen: Unterliekstrecker auffieren, Achterstag'
      + ' lose, Cunningham weg.');
    T.push('Der Holepunkt der Genua wandert nach vorn, weil die weit gefierte Schot das Achterliek'
      + ' sonst zu weit öffnet und das Vorsegel oben den Druck verliert.');
    return T.join(' ');
  }

  if (leicht) {
    T.push('Bei so wenig Druck lebt die Fahrt vom Bauch im Segel: Achterstag lose, Unterliekstrecker'
      + ' und Cunningham auffieren, damit sich das Profil rundet.');

    if (!abpowern) {
      T.push('Die Großschot nicht durchsetzen, sondern den Traveller nach Luv und die Schot eine'
        + ' Handbreit offen. So bleibt Twist im Segel und die Strömung liegt auch oben an.');
    }
  } else if (!flach) {
    T.push('Grundtrimm: Vorliekspannung gerade so weit, dass die Querfalten am Mast verschwinden,'
      + ' der Bauch steht in der Mitte.');
    T.push('Beim Rollgroß bleiben im Mittelwind etwa zwei Fäuste Abstand zwischen Baum und'
      + ' Unterliek. Diese Segel sind anders geschnitten und vertragen den harten Zug am'
      + ' Unterliekstrecker nicht.');
  } else {
    T.push(`Ab rund ${nf(FLACH_AB, 0)} kn wird zuerst über den Trimm abgepowert, nicht über die Fläche:`
      + ' Achterstag durchsetzen, damit sich der Mast biegt, das Groß flacher wird und das Vorstag'
      + ' weniger durchsackt; dazu Unterliekstrecker und Cunningham dicht, damit der Bauch nach vorn'
      + ' wandert statt nach achtern auszuwandern.');
    T.push('Ziehen sich Diagonalfalten vom Schothorn ins Segel, war es zu viel des Guten.');
  }

  if (t <= 2) {
    T.push('Holepunkt der Genua: Die gedachte Linie von der Mitte des Vorlieks durch das Schothorn'
      + ' zeigt auf die Schiene, das ist die Grundeinstellung. Genauer geht es über die Windfäden auf'
      + ' einem Viertel und auf drei Vierteln der Vorliekshöhe. Sie müssen gleichzeitig anstehen;'
      + ' brechen die oberen zuerst, steht der Holepunkt zu weit achtern.');
    if (flach) {
      T.push('Bei diesem Druck darf er ohnehin ein Loch weiter nach achtern: Das Achterliek öffnet'
        + ' oben, der Kopf powert ab, und das Schiff wird aufrechter, ohne dass Fläche verschwindet.');
    }
  } else {
    T.push('Mit der gefierten Schot wandert der Holepunkt der Genua nach vorn, sonst öffnet das'
      + ' Achterliek oben zu weit.');
  }

  T.push('Kontrolle am Großsegel: Die Windfäden am Achterliek sollen nach achtern abfließen, nur der'
    + ' oberste darf gelegentlich nach Lee wegklappen. Klappen die unteren mit weg, steht die Schot'
    + ' zu dicht.');

  if (t <= 2 && !leicht && !abpowern && b.seaValid && b.maxSteep > STEEP_SEA && b.maxHs >= 0.8) {
    T.push('Gegen die kurze, steile See braucht das Rigg mehr Twist als auf glattem Wasser:'
      + ' Großschot eine Idee fieren, Traveller nach Luv. Das Schiff arbeitet sich damit weicher'
      + ' durch die Wellen, statt in jeder zweiten stehenzubleiben.');
  }

  if (abpowern) {
    T.push('In der Böe zuerst den Traveller nach Lee: das nimmt Krängung, ohne den Anstellwinkel zu'
      + ' zerstören, und geht schneller als jedes Schotfieren.'

      + (flach ? ' Hilft das nicht mehr, ist das Reff dran und nicht noch mehr Achterstag.'
        : ' Hilft das nicht mehr, ist das Reff dran.'));
    T.push('Mehr als etwa 20° Krängung kosten diesen Rumpf Fahrt, statt sie zu bringen; der'
      + ' Ruderdruck ist dabei das bessere Maß als der Krängungsmesser.');
  }

  return T.join(' ');
}

function describeTrimmEn(b: Ablegezeit): string {
  const T: string[] = [];
  const t = twaBand(b.avgTwa);
  const leicht = windBand(b.maxWind, 'en').i <= 2;
  const flach = b.maxWind >= FLACH_AB;
  const abpowern = flach || b.maxGust >= FLACH_AB;

  if (t >= 5) {
    T.push('As soon as the boom goes out further than the traveller track reaches, the boom vang takes'
      + ' over leech tension: without it the boom rises, the top third of the mainsail twists off and'
      + ' stops driving.');
    T.push('The sail may stand full on this point of sail: ease the foot outhaul, backstay slack,'
      + ' cunningham off.');
    T.push('The genoa sheet lead moves forward, because the eased sheet would otherwise open the leech'
      + ' too far and the headsail would lose power aloft.');
    return T.join(' ');
  }

  if (leicht) {
    T.push('In this little wind, boat speed lives on draft in the sail: backstay slack, ease the foot'
      + ' outhaul and cunningham so the sail rounds up.');
    if (!abpowern) {
      T.push("Don't sheet the mainsail in hard: traveller to windward instead and the sheet a hand's"
        + ' width open, so twist stays in the sail and the flow stays attached aloft too.');
    }
  } else if (!flach) {
    T.push('Basic trim: just enough luff tension to make the horizontal creases at the mast disappear,'
      + ' the draft sitting amidships.');
    T.push('On an in-mast furling main, leave about two fists of gap between boom and foot in medium'
      + ' wind. These sails are cut differently and will not take a hard pull on the outhaul.');
  } else {
    T.push(`From about ${nf(FLACH_AB, 0, 'en')} kn the boat first depowers through trim, not through`
      + ' sail area: tension the backstay so the mast bends, the main flattens and the forestay sags'
      + ' less; on top of that, foot outhaul and cunningham hard on, so the draft moves forward instead'
      + ' of drifting aft.');
    T.push('If diagonal creases run from the clew into the sail, it was too much of a good thing.');
  }

  if (t <= 2) {
    T.push('Genoa sheet lead: the imaginary line from the middle of the luff through the clew onto the'
      + ' track is the baseline setting. A finer setting comes from the telltales at a quarter and'
      + ' three-quarters of the luff height. They must break at the same time; if the upper ones break'
      + ' first, the lead sits too far aft.');
    if (flach) {
      T.push('At this strength it can sit one hole further aft anyway: the leech opens up top, the head'
        + ' depowers, and the boat stands more upright without losing sail area.');
    }
  } else {
    T.push('With the sheet eased, the genoa sheet lead moves forward, otherwise the leech opens too far'
      + ' up top.');
  }

  T.push('Check on the mainsail: the leech telltales should stream aft, only the topmost one may'
    + ' flick to leeward now and then. If the lower ones flick away too, the sheet is too'
    + ' tight.');

  if (t <= 2 && !leicht && !abpowern && b.seaValid && b.maxSteep > STEEP_SEA && b.maxHs >= 0.8) {
    T.push('Against the short, steep sea the rig needs more twist than on flat water: ease the mainsheet'
      + ' a touch, traveller to windward. That lets the boat work through the waves more softly,'
      + ' instead of stalling in every second one.');
  }

  if (abpowern) {
    T.push('In a gust, traveller to leeward first: that takes off heel without destroying the angle of'
      + ' attack, and is quicker than easing any sheet.'
      + (flach ? " If that no longer helps, it's time to reef, not for more backstay."
        : ' If that no longer helps, it is time to reef.'));
    T.push('More than about 20° of heel costs this hull speed instead of adding it; helm load is the'
      + ' better gauge here than the heel indicator.');
  }

  return T.join(' ');
}
