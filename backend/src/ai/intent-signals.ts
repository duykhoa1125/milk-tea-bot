const QUICK_CHECKOUT_INTENT_REGEX =
  /\b(thanh\s*toan|checkout|chot\s*don|tinh\s*tien|tra\s*tien|xac\s*nhan\s*don)\b/i;
const QUICK_CART_EDIT_INTENT_REGEX =
  /\b(them|bo|doi|sua|giam|tang|xoa|replace|change|remove|update|chinh\s*sua\s*gio)\b/i;
const QUICK_ORDER_NOTE_INTENT_REGEX =
  /\b(note|ghi\s*chu|ghi\s*lai|dan|nhan)\b/i;

const INTENT_KEYWORD_MAP = {
  checkout: [
    "thanh toán",
    "checkout",
    "chốt đơn",
    "tính tiền",
    "trả tiền",
    "xác nhận đơn",
    "lên đơn",
  ],
  cartEdit: [
    "thêm",
    "bỏ",
    "đổi",
    "sửa",
    "giảm",
    "tăng",
    "xóa",
    "chỉnh sửa giỏ",
    "cập nhật giỏ",
    "replace",
    "change",
    "remove",
    "update",
  ],
  orderNote: [
    "note",
    "ghi chú",
    "ghi lại",
    "dặn",
    "nhắn",
    "lưu ý",
    "yêu cầu đặc biệt",
  ],
} as const;

export type IntentSignals = {
  normalizedPrompt: string;
  hasCheckoutIntent: boolean;
  hasCartEditIntent: boolean;
  hasOrderNoteIntent: boolean;
};

const normalizeVietnameseText = (input: string) =>
  input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đ]/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const NORMALIZED_INTENT_KEYWORD_MAP = {
  checkout: INTENT_KEYWORD_MAP.checkout.map(normalizeVietnameseText),
  cartEdit: INTENT_KEYWORD_MAP.cartEdit.map(normalizeVietnameseText),
  orderNote: INTENT_KEYWORD_MAP.orderNote.map(normalizeVietnameseText),
} as const;

const getKeywordHitCount = (
  normalizedPrompt: string,
  keywords: readonly string[],
) => keywords.filter((keyword) => normalizedPrompt.includes(keyword)).length;

export const detectIntentSignals = (userPrompt: string): IntentSignals => {
  const normalizedPrompt = normalizeVietnameseText(userPrompt);
  const checkoutKeywordHits = getKeywordHitCount(
    normalizedPrompt,
    NORMALIZED_INTENT_KEYWORD_MAP.checkout,
  );
  const cartEditKeywordHits = getKeywordHitCount(
    normalizedPrompt,
    NORMALIZED_INTENT_KEYWORD_MAP.cartEdit,
  );
  const orderNoteKeywordHits = getKeywordHitCount(
    normalizedPrompt,
    NORMALIZED_INTENT_KEYWORD_MAP.orderNote,
  );

  return {
    normalizedPrompt,
    hasCheckoutIntent:
      QUICK_CHECKOUT_INTENT_REGEX.test(normalizedPrompt) ||
      checkoutKeywordHits > 0,
    hasCartEditIntent:
      QUICK_CART_EDIT_INTENT_REGEX.test(normalizedPrompt) ||
      cartEditKeywordHits > 0,
    hasOrderNoteIntent:
      QUICK_ORDER_NOTE_INTENT_REGEX.test(normalizedPrompt) ||
      orderNoteKeywordHits > 0,
  };
};
