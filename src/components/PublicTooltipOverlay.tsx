import React from 'react';
import { Info, ThermometerSun, Droplets, Wind, Waves, Fish } from 'lucide-react';

interface TooltipDefinition {
  icon: React.ElementType;
  iconColor: string;
  headline: string;
  layman: string;
  climateImpact: string;
  unit: string;
}

const VARIABLE_TOOLTIPS: Record<string, TooltipDefinition> = {
  temperature: {
    icon: ThermometerSun,
    iconColor: '#f97316',
    headline: 'Sea Surface & Sub-surface Temperature',
    layman:
      'This is how warm or cold the ocean water is at different depths — like checking the temperature of a swimming pool, but going all the way down to 2km below the waves.',
    climateImpact:
      'Warmer surface water (above 28°C) is the primary fuel for tropical cyclones. Even a 0.5°C rise can upgrade a cyclone by one category, increasing wind speeds and storm surge by 10–20%.',
    unit: '°C',
  },
  salinity: {
    icon: Droplets,
    iconColor: '#38bdf8',
    headline: 'Ocean Salt Concentration',
    layman:
      'Salinity measures how salty the water is — think of the ocean as a giant soup, where some regions are saltier than others due to evaporation and river input.',
    climateImpact:
      'Freshwater from rivers (low salinity) floats on top of salty seawater, forming a barrier that traps heat and prevents ocean mixing. This directly intensifies monsoons and makes cyclones more powerful.',
    unit: 'PSU',
  },
  chlorophyll: {
    icon: Fish,
    iconColor: '#10b981',
    headline: 'Marine Phytoplankton & Ocean Colour',
    layman:
      'Chlorophyll is the green pigment in tiny marine plants called phytoplankton. High chlorophyll means more microscopic plants are blooming — like a spring meadow, but underwater.',
    climateImpact:
      'Phytoplankton blooms mark productive fishing zones. Over 500,000 Indian fishing families depend on INCOIS daily advisories that map these zones using this chlorophyll signal.',
    unit: 'mg/m³',
  },
  dissolved_oxygen: {
    icon: Wind,
    iconColor: '#a78bfa',
    headline: 'Dissolved Oxygen in Deep Water',
    layman:
      'Just like humans need oxygen to breathe, fish and marine life need dissolved oxygen in seawater. When oxygen drops near zero, it creates "dead zones" where almost no marine life can survive.',
    climateImpact:
      'Climate change is expanding oxygen minimum zones globally. As oceans warm, they hold less oxygen, compressing the habitable range for commercially important fish like tuna, shrinking fishery catches.',
    unit: 'mL/L',
  },
  current_u: {
    icon: Waves,
    iconColor: '#f59e0b',
    headline: 'East-West Ocean Current Velocity',
    layman:
      'This shows the speed of ocean water flowing east or west — like invisible rivers flowing beneath the sea surface, hundreds of kilometers wide and moving tonnes of heat energy across oceans.',
    climateImpact:
      'These currents redistribute heat from the equator toward the poles, regulating monsoon onset timing, coastal rainfall patterns, and the intensity of seasonal weather across South Asia.',
    unit: 'm/s',
  },
};

const STORY_TOOLTIPS: Record<string, { badge: string; badgeColor: string; note: string }> = {
  'bob-river-plume': {
    badge: 'Cyclone Risk Zone',
    badgeColor: '#f43f5e',
    note: 'The warm, freshwater-capped Bay of Bengal is India\'s most active cyclogenesis basin during post-monsoon.',
  },
  'arabian-sea-salinity': {
    badge: 'High Evaporation Basin',
    badgeColor: '#f59e0b',
    note: 'Arabian Sea evaporation drives moisture supply for the South Asian summer monsoon, influencing 1.4 billion people.',
  },
  'coastal-upwelling-fisheries': {
    badge: 'Active Fishing Zone',
    badgeColor: '#10b981',
    note: 'INCOIS issues real-time Potential Fishing Zone (PFZ) advisories to 500,000+ Indian fishermen daily.',
  },
  'oxygen-minimum-zone': {
    badge: 'Marine Hypoxia Zone',
    badgeColor: '#a78bfa',
    note: 'The Bay of Bengal OMZ is one of the largest natural hypoxic regions on Earth, expanding due to global warming.',
  },
};

interface PublicTooltipOverlayProps {
  activeVar: string;
  activeStoryId: string;
}

export const PublicTooltipOverlay: React.FC<PublicTooltipOverlayProps> = ({
  activeVar,
  activeStoryId,
}) => {
  const tip = VARIABLE_TOOLTIPS[activeVar] || VARIABLE_TOOLTIPS.temperature;
  const storyNote = STORY_TOOLTIPS[activeStoryId];
  const IconComp = tip.icon;

  return (
    <div
      className="pointer-events-none select-none"
      style={{ animation: 'fadeSlideUp 0.4s ease-out both' }}
    >
      {/* Story-specific badge */}
      {storyNote && (
        <div
          className="flex items-center gap-2 mb-3 px-3 py-1.5 rounded-full text-xs font-bold tracking-wider w-fit"
          style={{
            background: `${storyNote.badgeColor}18`,
            border: `1px solid ${storyNote.badgeColor}50`,
            color: storyNote.badgeColor,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: storyNote.badgeColor }}
          />
          {storyNote.badge}
        </div>
      )}

      {/* Main tooltip card */}
      <div
        className="op-card rounded-2xl p-4 flex flex-col gap-3 max-w-xs shadow-2xl"
        style={{ borderColor: `${tip.iconColor}40` }}
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: `${tip.iconColor}18`, border: `1px solid ${tip.iconColor}40` }}
          >
            <IconComp style={{ width: '18px', height: '18px', color: tip.iconColor }} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <Info style={{ width: '10px', height: '10px', color: '#94a3b8' }} />
              <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500">
                What You're Seeing
              </span>
            </div>
            <h4 className="text-[11px] font-bold text-white leading-snug">{tip.headline}</h4>
          </div>
        </div>

        {/* Layman explanation */}
        <p className="text-[11px] text-slate-300 leading-relaxed">{tip.layman}</p>

        {/* Climate impact */}
        <div
          className="rounded-lg p-2.5 text-[10px] leading-relaxed"
          style={{
            background: `${tip.iconColor}08`,
            borderLeft: `2px solid ${tip.iconColor}`,
            color: '#cbd5e1',
          }}
        >
          <span
            className="text-[9px] uppercase font-bold tracking-wider block mb-1"
            style={{ color: tip.iconColor }}
          >
            Real-World Climate Impact:
          </span>
          {tip.climateImpact}
        </div>

        {/* Story note */}
        {storyNote && (
          <p className="text-[10px] text-slate-500 leading-relaxed border-t border-slate-800 pt-2">
            {storyNote.note}
          </p>
        )}
      </div>
    </div>
  );
};
