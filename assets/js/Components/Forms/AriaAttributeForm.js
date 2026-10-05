import React, { useEffect, useState } from "react";
import RadioSelector from "../Widgets/RadioSelector";
import OptionFeedback from "../Widgets/OptionFeedback";
import Combobox from "../Widgets/Combobox";
import * as Html from "../../Services/Html";
import { UFIXIT_OPTIONS } from "../../Services/Constants";
import {
  ARIA_ATTRIBUTE_DEFINITIONS,
  getAriaAttributeDecision,
  getReportedAriaAttributes,
} from "../../Services/AriaAttributes";

const REMOVAL_ONLY_RULES = new Set([
  "aria_attribute_allowed",
  "aria_attribute_deprecated",
  "aria_attribute_redundant",
]);

function isValidValue(attributeName, value) {
  const definition = ARIA_ATTRIBUTE_DEFINITIONS[attributeName];
  if (!value || !definition) {
    return Boolean(value);
  }
  if (definition.type === "finite") {
    return definition.values.includes(value);
  }
  if (definition.type === "integer") {
    return /^-?\d+$/.test(value);
  }
  if (definition.type === "number") {
    return Number.isFinite(Number(value));
  }
  if (definition.type === "token-list") {
    const tokens = value.trim().split(/\s+/);
    return tokens.every((token) => definition.values.includes(token)) &&
      !(tokens.length > 1 && tokens.includes("all"));
  }
  return true;
}

export default function AriaAttributeForm({
  t,
  activeIssue,
  isDisabled,
  handleActiveIssue,
  activeOption,
  setActiveOption,
  formErrors,
  setFormErrors,
}) {
  const FORM_OPTIONS = {
    SELECT_VALUE: UFIXIT_OPTIONS.SELECT_ATTRIBUTE_VALUE,
    DELETE_ATTRIBUTE: UFIXIT_OPTIONS.DELETE_ATTRIBUTE,
    MARK_AS_REVIEWED: UFIXIT_OPTIONS.MARK_AS_REVIEWED,
  };
  const [attributeNames, setAttributeNames] = useState([]);
  const [attributeValues, setAttributeValues] = useState({});

  useEffect(() => {
    const names = activeIssue ? getReportedAriaAttributes(activeIssue) : [];
    const element = activeIssue ? Html.toElement(Html.getIssueHtml(activeIssue)) : null;
    const values = Object.fromEntries(names.map((name) => {
      const value = Html.getAttribute(element, name) || "";
      return [name, isValidValue(name, value) ? value : ""];
    }));
    setAttributeNames(names);
    setAttributeValues(values);

    if (!activeIssue) {
      return;
    }
    const reviewed = activeIssue.newHtml && [2, 3].includes(activeIssue.status);
    const fixed = activeIssue.newHtml && [1, 3].includes(activeIssue.status);
    if (reviewed) {
      setActiveOption(FORM_OPTIONS.MARK_AS_REVIEWED);
    } else if (fixed && names.every((name) => !Html.hasAttribute(element, name))) {
      setActiveOption(FORM_OPTIONS.DELETE_ATTRIBUTE);
    } else if (fixed && names.every((name) => isValidValue(name, values[name]))) {
      setActiveOption(FORM_OPTIONS.SELECT_VALUE);
    } else {
      setActiveOption("");
    }
  }, [activeIssue?.id, activeIssue?.status]);

  useEffect(() => {
    const errors = {
      [FORM_OPTIONS.SELECT_VALUE]: [],
      [FORM_OPTIONS.DELETE_ATTRIBUTE]: [],
    };
    if (
      activeOption === FORM_OPTIONS.SELECT_VALUE &&
      attributeNames.some((name) => !isValidValue(name, attributeValues[name]))
    ) {
      errors[FORM_OPTIONS.SELECT_VALUE].push({
        text: t("form.aria_attribute.msg.attribute_required"),
        type: "error",
      });
    }
    setFormErrors(errors);

    if (!activeIssue || attributeNames.length === 0 || activeOption === "") {
      return;
    }
    const issue = activeIssue;
    if (activeOption === FORM_OPTIONS.MARK_AS_REVIEWED) {
      issue.newHtml = issue.initialHtml || issue.sourceHtml;
    } else {
      let element = Html.toElement(Html.getIssueHtml(issue));
      attributeNames.forEach((name) => {
        element = activeOption === FORM_OPTIONS.DELETE_ATTRIBUTE
          ? Html.removeAttribute(element, name)
          : Html.setAttribute(element, name, attributeValues[name]);
      });
      issue.newHtml = Html.toString(element);
    }
    handleActiveIssue(issue);
  }, [activeOption, attributeNames, attributeValues]);

  const handleValueChange = (attributeName, value) => {
    setActiveOption(FORM_OPTIONS.SELECT_VALUE);
    setAttributeValues((values) => ({ ...values, [attributeName]: value }));
  };

  const removalOnly = REMOVAL_ONLY_RULES.has(activeIssue?.scanRuleId);
  const isGrouped = attributeNames.length > 1;

  const renderValueControl = (attributeName) => {
    const definition = ARIA_ATTRIBUTE_DEFINITIONS[attributeName];
    const decision = getAriaAttributeDecision(activeIssue, attributeName);
    const inputId = `aria-attribute-${attributeName}`;
    const controlLabel = isGrouped
      ? t(decision.questionKey, { attributeName })
      : t(decision.answerKey, { attributeName });

    return (
      <div className={isGrouped ? "resolve-option mb-2" : ""} key={attributeName}>
        {definition?.type === "finite" ? (
          <Combobox
            handleChange={(id, value) => handleValueChange(attributeName, value)}
            id={inputId}
            isDisabled={isDisabled}
            label={controlLabel}
            options={[
              {
                value: "",
                name: t("form.aria_attribute.answer.select"),
                selected: !attributeValues[attributeName],
              },
              ...definition.values.map((value) => ({
                value,
                name: value,
                selected: value === attributeValues[attributeName],
              })),
            ]}
          />
        ) : (
          <>
            <label id={`${inputId}-label`} className="option-label" htmlFor={inputId}>
              {controlLabel}
            </label>
            <input
              aria-labelledby={`${inputId}-label`}
              className="w-100"
              disabled={isDisabled}
              id={inputId}
              onChange={(event) => handleValueChange(attributeName, event.target.value)}
              placeholder={t("form.aria_attribute.answer.placeholder")}
              type="text"
              value={attributeValues[attributeName] || ""}
            />
          </>
        )}
      </div>
    );
  };

  return (
    <>
      {!removalOnly && (
        <div className={`resolve-option ${activeOption === FORM_OPTIONS.SELECT_VALUE ? "selected" : ""}`}>
          <RadioSelector
            activeOption={activeOption}
            isDisabled={isDisabled || attributeNames.length === 0}
            setActiveOption={setActiveOption}
            option={FORM_OPTIONS.SELECT_VALUE}
            labelText={t(
              isGrouped
                ? "form.aria_attribute.label.change_multiple"
                : "form.aria_attribute.label.change",
            )}
          />
          <div className="indented mt-2">
            {isGrouped && (
              <p className="mb-2">
                {t("form.aria_attribute.group.instructions", { count: attributeNames.length })}
              </p>
            )}
            {attributeNames.map(renderValueControl)}
            <OptionFeedback
              t={t}
              feedbackArray={formErrors[FORM_OPTIONS.SELECT_VALUE]}
            />
          </div>
        </div>
      )}

      <div className={`resolve-option ${activeOption === FORM_OPTIONS.DELETE_ATTRIBUTE ? "selected" : ""}`}>
        <RadioSelector
          activeOption={activeOption}
          isDisabled={isDisabled || attributeNames.length === 0}
          setActiveOption={setActiveOption}
          option={FORM_OPTIONS.DELETE_ATTRIBUTE}
          labelText={t("form.aria_attribute.label.remove")}
        />
      </div>

      <div className={`resolve-option ${activeOption === FORM_OPTIONS.MARK_AS_REVIEWED ? "selected" : ""}`}>
        <RadioSelector
          activeOption={activeOption}
          isDisabled={isDisabled}
          setActiveOption={setActiveOption}
          option={FORM_OPTIONS.MARK_AS_REVIEWED}
          labelText={t("fix.label.no_changes")}
        />
      </div>
    </>
  );
}
