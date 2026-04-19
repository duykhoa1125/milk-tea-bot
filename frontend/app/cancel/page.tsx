import React from "react";

type CancelPageProps = {
  searchParams?: {
    orderCode?: string;
  };
};

function CancelPage({ searchParams }: CancelPageProps) {
  return (
    <main className="min-h-screen px-6 py-12 flex items-center justify-center">
      <section className="menu-ticket w-full max-w-xl overflow-hidden">
        <div className="bg-linear-to-br from-amber-500 via-orange-500 to-rose-500 px-6 py-5 text-white">
          <p className="text-sm uppercase tracking-[0.35em] opacity-80">
            Payment cancelled
          </p>
          <h1 className="mt-2 text-3xl font-serif">Thanh toán chưa hoàn tất</h1>
        </div>

        <div className="space-y-4 px-6 py-8 text-base leading-7">
          <p>
            Đơn hàng
            {searchParams?.orderCode ? ` #${searchParams.orderCode}` : ""} chưa
            được thanh toán. Bạn có thể quay lại chatbot để tạo lại link thanh
            toán hoặc chỉnh sửa giỏ hàng.
          </p>
          <p className="text-sm text-black/60">
            Khi giao dịch hoàn tất, webhook sẽ tự cập nhật trạng thái đơn cho
            bot.
          </p>
        </div>
      </section>
    </main>
  );
}

export default CancelPage;
