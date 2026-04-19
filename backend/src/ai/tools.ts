import { FunctionDeclaration, SchemaType } from '@google/generative-ai';

export const addToCartDeclaration: FunctionDeclaration = {
    name: "add_item_to_cart",
    description: "Gọi hàm này khi người dùng quyết định đặt thêm một món hoặc mua một món nước/trà sữa vào giỏ hàng.",
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            productId: {
                type: SchemaType.STRING,
                description: "Mã ID của món nước dựa theo menu (ví dụ: TS01, TTG01)"
            },
            productName: {
                type: SchemaType.STRING,
                description: "Tên món nước uống khách muốn đặt (phải dựa theo menu)"
            },
            size: {
                type: SchemaType.STRING,
                description: "Kích cỡ món (chỉ được là 'M' hoặc 'L')",
            },
            toppings: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING },
                description: "Danh sách topping thêm (vd: 'Trân châu đen', 'Kem cheese'). Gửi mảng rỗng nếu không có."
            },
            note: {
                type: SchemaType.STRING,
                description: "Ghi chú của khách (vd: 'ít đá', 'nhiều đường', 'không ngọt'). Nếu không có thì để trống."
            },
            quantity: {
                type: SchemaType.INTEGER,
                description: "Số lượng ly"
            }
        },
        required: ["productId", "productName", "size", "toppings", "quantity", "note"]
    }
};

export const viewCartDeclaration: FunctionDeclaration = {
    name: "view_user_cart",
    description: "Gọi hàm này khi người dùng muốn xem lại đơn hàng, hỏi xem trong giỏ hàng có gì, hoặc trước khi tính tiền để kiểm tra.",
    // Không cần tham số gì cũng được vì chúng ta sẽ tự handle UserID!
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            action: { type: SchemaType.STRING, description: "Cứ truyền chữ 'view'" }
        }
    }
};

//Khi khách muốn chốt đơn, Tool trên AI sẽ được gọi thông qua function sau. Tool này đẩy giỏ hàng từ Upstash Redis vào PostgreSQL.
export const checkoutCartDeclaration: FunctionDeclaration = {
    name: "checkout_cart",
    description: "Gọi khi người dùng nói 'chốt đơn', 'thanh toán', 'tính tiền'.",
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            note: { type: SchemaType.STRING, description: "Ghi chú chung do khách yêu cầu cho cả đơn lấy nĩa, không lấy biên lai (nếu có)" }
        }
    }
};