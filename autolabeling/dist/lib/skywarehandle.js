import { LabelerServer } from "@skyware/labeler";
class ExternalLabelerServer extends LabelerServer {
    // private は直接呼べないので any キャストを使う（非推奨だが動く）
    emitLabelExternal(seq, label) {
        // @ts-ignore で private にアクセス
        this.emitLabel(seq, label);
    }
}
