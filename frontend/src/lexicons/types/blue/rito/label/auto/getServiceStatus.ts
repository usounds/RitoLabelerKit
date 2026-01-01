import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";

const _mainSchema = /*#__PURE__*/ v.query(
  "blue.rito.label.auto.getServiceStatus",
  {
    params: null,
    output: {
      type: "lex",
      schema: /*#__PURE__*/ v.object({
        /**
         * User's preferred language for Auto Generate Bookmark.
         */
        cursor: /*#__PURE__*/ v.datetimeString(),
        /**
         * Whether to automatically collect Bluesky posts to Rito bookmarks.
         */
        version: /*#__PURE__*/ v.string(),
      }),
    },
  },
);

type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}

export const mainSchema = _mainSchema as mainSchema;

export interface $params {}
export interface $output extends v.InferXRPCBodyInput<mainSchema["output"]> {}

declare module "@atcute/lexicons/ambient" {
  interface XRPCQueries {
    "blue.rito.label.auto.getServiceStatus": mainSchema;
  }
}
