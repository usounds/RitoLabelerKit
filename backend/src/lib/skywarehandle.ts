

import { LabelerServer } from "@skyware/labeler";

class ExternalLabelerServer extends LabelerServer {
  // private は直接呼べないので any キャストを使う（非推奨だが動く）
  emitLabelExternal(seq: number, label: any) {
    // @ts-ignore で private にアクセス
    (this as any).emitLabel(seq, label);
  }
}

