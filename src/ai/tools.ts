import { FunctionDeclaration, SchemaType } from '@google/generative-ai';

export const addToCartDeclaration: FunctionDeclaration = {
    name: "add_item_to_cart",
    description: "Gọi hàm này khi người dùng quyết định đặt thêm một món hoặc mua một món nước/trà sữa vào giỏ hàng.",
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
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
        required: ["productName", "size", "toppings", "quantity", "note"]
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