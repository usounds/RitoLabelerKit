import * as v from "@atcute/lexicons/validations";
const _mainSchema = /*#__PURE__*/ v.record(
/*#__PURE__*/ v.string(), 
/*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.literal("blue.rito.label.auto.like"),
    createdAt: /*#__PURE__*/ v.datetimeString(),
    /**
     * When this post receives a Like, it controls whether to apply or remove a label.
     */
    subject: /*#__PURE__*/ v.genericUriString(),
}));
export const mainSchema = _mainSchema;
