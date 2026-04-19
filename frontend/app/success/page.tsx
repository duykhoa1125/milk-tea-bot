import React from "react";

type SuccessPageProps = {
  searchParams?: {
    orderCode?: string;
  };
};

function SuccessPage({ searchParams }: SuccessPageProps) {
  return (
    <main className="min-h-screen px-6 py-12 flex items-center justify-center">
      <section className="menu-ticket w-full max-w-xl overflow-hidden">
        <div className="bg-linear-to-br from-emerald-500 via-teal-500 to-cyan-600 px-6 py-5 text-white">
          <p className="text-sm uppercase tracking-[0.35em] opacity-80">
            Payment complete
          </p>
          <h1 className="mt-2 text-3xl font-serif">Thanh toán thành công</h1>
        </div>

        <div className="space-y-4 px-6 py-8 text-base leading-7">
          <p>
            Đơn hàng
            {searchParams?.orderCode ? ` #${searchParams.orderCode}` : ""} đã
            được ghi nhận. Hệ thống đang đồng bộ trạng thái với chatbot Telegram
            của bạn.
          </p>
          <p className="text-sm text-black/60">
            Bạn có thể quay lại Telegram để theo dõi trạng thái chế biến hoặc
            đợi bot nhắn xác nhận tự động.
          </p>
        </div>
      </section>
    </main>
  );
}

export default SuccessPage;
