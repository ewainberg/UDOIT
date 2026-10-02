/*
 * ARIA attribute reference for decision-based Ufixit flows.
 * Value names follow WAI-ARIA. Questions are intentionally plain-language so
 * a future form can present a decision without requiring ARIA knowledge.
 *
 * finiteValues is present only when the attribute has a closed value set.
 * Attributes with ID references, numbers, or authored text need specialized
 * controls and should not be treated as generic finite-value dropdowns.
 */

export const ARIA_ATTRIBUTE_DEFINITIONS = {
  "aria-activedescendant": {
    valueType: "idref",
    question: "Which item should be treated as the currently active item?",
  },
  "aria-atomic": {
    valueType: "boolean",
    finiteValues: ["true", "false"],
    question:
      "When this area changes, should assistive technology read the whole area?",
  },
  "aria-autocomplete": {
    valueType: "token",
    finiteValues: ["none", "inline", "list", "both"],
    question: "How does this field help users complete what they are typing?",
  },
  "aria-busy": {
    valueType: "boolean",
    finiteValues: ["true", "false"],
    question: "Is this area currently being updated or loaded?",
  },
  "aria-checked": {
    valueType: "token",
    finiteValues: ["true", "false", "mixed"],
    question:
      "Is this checkbox or selectable control checked, unchecked, or partly checked?",
  },
  "aria-colcount": {
    valueType: "integer",
    question: "How many columns does this grid or table have?",
  },
  "aria-colindex": {
    valueType: "integer",
    question: "What is this column's position in the complete grid or table?",
  },
  "aria-colindextext": {
    valueType: "text",
    question: "What short text should describe this column's position?",
  },
  "aria-colspan": {
    valueType: "integer",
    question: "How many columns does this cell span?",
  },
  "aria-controls": {
    valueType: "idrefs",
    question: "Which area does this control open, close, or update?",
  },
  "aria-current": {
    valueType: "token",
    finiteValues: ["false", "page", "step", "location", "date", "time", "true"],
    question:
      "Does this identify the user's current page, step, location, date, or time?",
  },
  "aria-describedby": {
    valueType: "idrefs",
    question: "Which existing text gives this item extra information?",
  },
  "aria-description": {
    valueType: "text",
    question: "What extra description should assistive technology announce?",
  },
  "aria-details": {
    valueType: "idref",
    question:
      "Which existing area contains the detailed information for this item?",
  },
  "aria-disabled": {
    valueType: "boolean",
    finiteValues: ["true", "false"],
    question: "Is this control currently unavailable?",
  },
  "aria-dropeffect": {
    valueType: "token-list",
    finiteValues: ["copy", "move", "link", "execute", "popup", "none"],
    deprecated: true,
    question: "What will happen when dragged content is dropped here?",
  },
  "aria-errormessage": {
    valueType: "idref",
    question: "Which existing text explains the error for this field?",
  },
  "aria-expanded": {
    valueType: "boolean",
    finiteValues: ["true", "false"],
    question: "Is the controlled content currently expanded and visible?",
  },
  "aria-flowto": {
    valueType: "idrefs",
    question: "Which content should users move to next?",
  },
  "aria-grabbed": {
    valueType: "boolean",
    finiteValues: ["true", "false"],
    deprecated: true,
    question: "Is this item currently selected for dragging?",
  },
  "aria-haspopup": {
    valueType: "token",
    finiteValues: [
      "false",
      "true",
      "menu",
      "listbox",
      "tree",
      "grid",
      "dialog",
    ],
    question: "What kind of popup does this control open?",
  },
  "aria-hidden": {
    valueType: "boolean",
    finiteValues: ["true", "false"],
    question: "Should assistive technology ignore this content?",
  },
  "aria-invalid": {
    valueType: "token",
    finiteValues: ["false", "true", "grammar", "spelling"],
    question:
      "Is this value invalid, and if so, is the problem spelling or grammar?",
  },
  "aria-keyshortcuts": {
    valueType: "text",
    question: "What keyboard shortcut can users use for this control?",
  },
  "aria-label": {
    valueType: "text",
    question: "What short name should assistive technology use for this item?",
  },
  "aria-labelledby": {
    valueType: "idrefs",
    question: "Which existing visible text should name this item?",
  },
  "aria-level": {
    valueType: "integer",
    question: "What level is this item within its hierarchy?",
  },
  "aria-live": {
    valueType: "token",
    finiteValues: ["off", "polite", "assertive"],
    question:
      "When this area changes, how urgently should assistive technology announce it?",
  },
  "aria-modal": {
    valueType: "boolean",
    finiteValues: ["true", "false"],
    question:
      "Does this dialog require users to finish here before returning to the page?",
  },
  "aria-multiline": {
    valueType: "boolean",
    finiteValues: ["true", "false"],
    question: "Can this text field contain more than one line?",
  },
  "aria-multiselectable": {
    valueType: "boolean",
    finiteValues: ["true", "false"],
    question: "Can users select more than one option in this list or grid?",
  },
  "aria-orientation": {
    valueType: "token",
    finiteValues: ["horizontal", "vertical"],
    question: "Does this control run horizontally or vertically?",
  },
  "aria-owns": {
    valueType: "idrefs",
    question:
      "Which existing items belong to this control even though they are elsewhere in the page structure?",
  },
  "aria-placeholder": {
    valueType: "text",
    question: "What example or hint should appear when this field is empty?",
  },
  "aria-posinset": {
    valueType: "integer",
    question: "What position does this item have in the complete set?",
  },
  "aria-pressed": {
    valueType: "token",
    finiteValues: ["true", "false", "mixed"],
    question: "Is this toggle button on, off, or partly on?",
  },
  "aria-readonly": {
    valueType: "boolean",
    finiteValues: ["true", "false"],
    question: "Can users view this value but not change it?",
  },
  "aria-relevant": {
    valueType: "token-list",
    finiteValues: ["additions", "removals", "text", "all"],
    question: "Which kinds of changes should assistive technology announce?",
  },
  "aria-required": {
    valueType: "boolean",
    finiteValues: ["true", "false"],
    question: "Must users provide a value before continuing?",
  },
  "aria-roledescription": {
    valueType: "text",
    question:
      "What short custom description should assistive technology use for this item?",
  },
  "aria-rowcount": {
    valueType: "integer",
    question: "How many rows does this grid or table have?",
  },
  "aria-rowindex": {
    valueType: "integer",
    question: "What is this row's position in the complete grid or table?",
  },
  "aria-rowindextext": {
    valueType: "text",
    question: "What short text should describe this row's position?",
  },
  "aria-rowspan": {
    valueType: "integer",
    question: "How many rows does this cell span?",
  },
  "aria-selected": {
    valueType: "boolean",
    finiteValues: ["true", "false"],
    question: "Is this option or item currently selected?",
  },
  "aria-setsize": {
    valueType: "integer",
    question: "How many items are in the complete set?",
  },
  "aria-sort": {
    valueType: "token",
    finiteValues: ["ascending", "descending", "none", "other"],
    question: "How is this column currently sorted?",
  },
  "aria-valuemax": {
    valueType: "number",
    question: "What is the highest possible value?",
  },
  "aria-valuemin": {
    valueType: "number",
    question: "What is the lowest possible value?",
  },
  "aria-valuenow": {
    valueType: "number",
    question: "What is the current value?",
  },
  "aria-valuetext": {
    valueType: "text",
    question: "What text should describe the current value?",
  },
};

export const FINITE_ARIA_ATTRIBUTES = Object.fromEntries(
  Object.entries(ARIA_ATTRIBUTE_DEFINITIONS).filter(
    ([, definition]) => definition.finiteValues,
  ),
);
