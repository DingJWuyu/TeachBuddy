/*
 * The label palette. Schedule labels and resource tags pick from the same eight
 * colours (the schedule's label dialog in the app bundle uses these values), so
 * a tag looks the same wherever it appears. A tag saved without a colour takes
 * one by its position, so it still keeps the same colour everywhere.
 */
export const LABEL_COLORS = ['#ff6b75', '#3edc81', '#5b9cf5', '#a78bfa', '#ffb454', '#f27ab8', '#43c6c6', '#9ba0aa'];
export const colorOf = (item, index = 0) => item?.color || LABEL_COLORS[((index % LABEL_COLORS.length) + LABEL_COLORS.length) % LABEL_COLORS.length];
