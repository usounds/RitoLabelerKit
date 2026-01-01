import * as v from "@atcute/lexicons/validations";
const _mainSchema = /*#__PURE__*/ v.record(
/*#__PURE__*/ v.tidString(), 
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
     */
    condition: /*#__PURE__*/ v.string(),
    createdAt: /*#__PURE__*/ v.datetimeString(),
    /**
     * Hour based label dulation. 0 will be no duration.
     */
    durationInHours: /*#__PURE__*/ v.integer(),
    /**
     * If condition are matched, which label are applyed or removed.
     */
    label: /*#__PURE__*/ v.string(),
}));
export const mainSchema = _mainSchema;
