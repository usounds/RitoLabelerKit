import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";

const _mainSchema = /*#__PURE__*/ v.record(
  /*#__PURE__*/ v.literal("self"),
  /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.literal("blue.rito.label.auto.like.settings"),
    /**
     * The post to apply the label to
     */
    get apply() {
      return /*#__PURE__*/ v.variant([postRefSchema]);
    },
    createdAt: /*#__PURE__*/ v.datetimeString(),
    /**
     * The post to remove the label from
     */
    get delete() {
      return /*#__PURE__*/ v.optional(/*#__PURE__*/ v.variant([postRefSchema]));
    },
  }),
);
const _postRefSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("blue.rito.label.auto.like.settings#postRef"),
  ),
  /**
   * CID of the post
   */
  cid: /*#__PURE__*/ v.string(),
  /**
   * URI of the post
   */
  uri: /*#__PURE__*/ v.genericUriString(),
});

type main$schematype = typeof _mainSchema;
type postRef$schematype = typeof _postRefSchema;

export interface mainSchema extends main$schematype {}
export interface postRefSchema extends postRef$schematype {}

export const mainSchema = _mainSchema as mainSchema;
export const postRefSchema = _postRefSchema as postRefSchema;

export interface Main extends v.InferInput<typeof mainSchema> {}
export interface PostRef extends v.InferInput<typeof postRefSchema> {}

declare module "@atcute/lexicons/ambient" {
  interface Records {
    "blue.rito.label.auto.like.settings": mainSchema;
  }
}
