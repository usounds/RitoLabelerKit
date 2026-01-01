import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";

const _mainSchema = /*#__PURE__*/ v.record(
  /*#__PURE__*/ v.string(),
  /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.literal("blue.rito.label.auto.post"),
    /**
     * Required for 'account', It should be 'add' or 'remove'
     */
    action: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
    /**
     * 'account' or 'post'
     */
    appliedTo: /*#__PURE__*/ v.string(),
    /**
     * Setting apply condition with regex
     * @minLength 100
     * @minGraphemes 10
     */
    condition: /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
      /*#__PURE__*/ v.stringLength(100),
      /*#__PURE__*/ v.stringGraphemes(10),
    ]),
    createdAt: /*#__PURE__*/ v.datetimeString(),
    /**
     * Hour based label dulation. 0 will be no duration.
     */
    durationInHours: /*#__PURE__*/ v.integer(),
    /**
     * If condition are matched, which label are applyed or removed.
     */
    label: /*#__PURE__*/ v.string(),
  }),
);

type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}

export const mainSchema = _mainSchema as mainSchema;

export interface Main extends v.InferInput<typeof mainSchema> {}

declare module "@atcute/lexicons/ambient" {
  interface Records {
    "blue.rito.label.auto.post": mainSchema;
  }
}
