import { LEGAL } from './legal.config';

export type LegalKind = 'terms' | 'privacy' | 'refund';

export interface LegalSection {
  title: string;
  /** Paragraphs; a line starting with "- " is a bullet. */
  body: string[];
}

export interface LegalDoc {
  title: string;
  description: string;
  lead: string;
  sections: LegalSection[];
}

const who = () => `${LEGAL.operatorName}${LEGAL.registrationNo ? ` (${LEGAL.registrationNo})` : ''}`;
const contact = () => LEGAL.contactEmail;

/**
 * DRAFT TEXT. These are plain-language drafts written for a small digital service in Vietnam; they are not legal advice.
 * Have a lawyer review them (consumer protection law, Nghị định 13/2023/NĐ-CP on personal data, e-commerce rules)
 * before relying on them, and make sure they match what the service really does.
 */
export function legalDoc(kind: LegalKind, lang: 'vi' | 'en' = 'vi'): LegalDoc {
  return lang === 'en' ? legalDocEn(kind) : legalDocVi(kind);
}

function legalDocVi(kind: LegalKind): LegalDoc {
  switch (kind) {
    case 'terms':
      return {
        title: 'Điều khoản sử dụng',
        description: 'Điều khoản sử dụng Hanoi Century Vista: phạm vi dịch vụ, tài khoản, gói Premium, lượt hỏi AI, giới hạn trách nhiệm.',
        lead: `Khi tạo tài khoản hoặc sử dụng Hanoi Century Vista (“dịch vụ”), bạn đồng ý với các điều khoản dưới đây. Dịch vụ do ${who()} vận hành.`,
        sections: [
          { title: '1. Dịch vụ là gì', body: ['Hanoi Century Vista cung cấp bản đồ, điểm số và phân tích tham khảo về Hà Nội: Mở gì ở đâu (bản đồ cơ hội kinh doanh), Hà Nội xưa và nay, Điểm đáng sống, Hà Nội tương lai, Chấm điểm bất động sản và La bàn nghề nghiệp.', 'Dữ liệu và kết quả chỉ để tham khảo. Nhiều số liệu là mẫu, ước tính hoặc kịch bản; mỗi công cụ ghi rõ nguồn, thời điểm dữ liệu và độ tin cậy nếu có. Dịch vụ không phải là tư vấn đầu tư, pháp lý, tài chính hay bất động sản.'] },
          { title: '2. Tài khoản', body: ['Bạn cần email hợp lệ và mật khẩu để tạo tài khoản. Bạn chịu trách nhiệm giữ bí mật mật khẩu và mọi hoạt động trong tài khoản.', 'Bạn có thể xoá tài khoản bất cứ lúc nào trong mục Tài khoản; báo cáo đã lưu sẽ bị xoá cùng.', 'Chúng tôi có thể tạm khoá tài khoản có dấu hiệu lạm dụng, gian lận hoặc làm quá tải hệ thống.'] },
          { title: '3. Gói Premium, lượt hỏi AI và báo cáo trả phí', body: ['Một số tính năng miễn phí có giới hạn theo ngày (giờ Việt Nam). Gói Premium và các gói lượt hỏi AI là sản phẩm số, thanh toán một lần cho thời hạn hoặc số lượt ghi trên trang Premium; không tự động gia hạn trừ khi trang ghi rõ.', 'Một lượt hỏi AI chỉ bị trừ khi câu trả lời thật sự do AI viết; nếu AI lỗi và hệ thống trả lời theo mẫu, lượt được hoàn lại.', 'Giá, số lượt và thời hạn có thể thay đổi cho các giao dịch về sau; giao dịch đã hoàn tất không bị ảnh hưởng. Chính sách hoàn tiền nằm ở trang Chính sách hoàn tiền.'] },
          { title: '4. Câu trả lời của AI', body: ['Câu trả lời do AI tạo ra từ dữ liệu của dịch vụ và có thể chưa đầy đủ hoặc sai. Hãy kiểm tra thông tin quan trọng với nguồn gốc trước khi ra quyết định.'] },
          { title: '5. Sử dụng được và không được', body: ['Bạn được dùng dịch vụ cho mục đích cá nhân hoặc kinh doanh hợp pháp của mình. Bạn không được:', '- thu thập dữ liệu hàng loạt, tự động hoá truy cập hoặc phá vỡ giới hạn sử dụng;', '- cố truy cập trái phép, dò quét lỗ hổng hoặc làm gián đoạn dịch vụ;', '- bán lại hoặc phân phối lại dữ liệu, báo cáo trả phí của dịch vụ khi chưa được phép;', '- nhập nội dung vi phạm pháp luật hoặc xâm phạm quyền của người khác.'] },
          { title: '6. Quyền sở hữu và dữ liệu bên thứ ba', body: ['Mã nguồn, thiết kế và nội dung do dịch vụ tạo ra thuộc về chủ sở hữu dịch vụ. Dữ liệu bản đồ lấy từ OpenStreetMap (© những người đóng góp OpenStreetMap, giấy phép ODbL) và các nguồn công khai khác được ghi nguồn trong từng công cụ.', 'Ảnh tư liệu lịch sử trong Hà Nội xưa và nay thuộc quyền của chủ sở hữu từng ảnh, được ghi nguồn bên cạnh ảnh.'] },
          { title: '7. Giới hạn trách nhiệm', body: ['Dịch vụ được cung cấp “như hiện có”. Trong phạm vi pháp luật cho phép, chúng tôi không chịu trách nhiệm về thiệt hại gián tiếp, mất lợi nhuận hoặc quyết định kinh doanh, đầu tư của bạn dựa trên kết quả tham khảo. Tổng trách nhiệm của chúng tôi với một khách hàng không vượt quá số tiền khách hàng đã thanh toán cho dịch vụ trong 12 tháng gần nhất. Điều này không loại trừ quyền lợi mà pháp luật bảo vệ người tiêu dùng dành cho bạn.'] },
          { title: '8. Thay đổi điều khoản', body: ['Chúng tôi có thể cập nhật điều khoản và sẽ đổi ngày hiệu lực ở đầu trang. Với thay đổi quan trọng, chúng tôi sẽ thông báo trên dịch vụ hoặc qua email. Tiếp tục sử dụng sau ngày hiệu lực nghĩa là bạn đồng ý bản mới.'] },
          { title: '9. Luật áp dụng và liên hệ', body: ['Điều khoản này chịu sự điều chỉnh của pháp luật Việt Nam. Tranh chấp được ưu tiên giải quyết qua thương lượng; nếu không được, giải quyết tại toà án có thẩm quyền ở Việt Nam.', `Liên hệ: ${contact()}${LEGAL.address ? ` · ${LEGAL.address}` : ''}.`] },
        ],
      };
    case 'privacy':
      return {
        title: 'Chính sách quyền riêng tư',
        description: 'Hanoi Century Vista thu thập, dùng và bảo vệ dữ liệu cá nhân của bạn như thế nào; quyền của bạn theo Nghị định 13/2023/NĐ-CP.',
        lead: `Trang này giải thích ${who()} thu thập dữ liệu gì, dùng để làm gì, chia sẻ với ai và bạn có những quyền nào.`,
        sections: [
          { title: '1. Dữ liệu chúng tôi thu thập', body: ['- Tài khoản: email, tên hiển thị (nếu bạn nhập), mật khẩu (chỉ lưu dạng băm, không lưu mật khẩu gốc), thời điểm tạo tài khoản, thời điểm bạn đồng ý điều khoản và xác minh email.', '- Nội dung bạn lưu: báo cáo đã lưu của công cụ Mở gì ở đâu, cài đặt, cùng thông tin mua gói (mã đơn, số tiền, trạng thái, lượt AI đã dùng).', '- Câu hỏi bạn gõ cho các công cụ AI.', '- Kỹ thuật: cookie phiên đăng nhập (HttpOnly), địa chỉ IP và thông tin trình duyệt trong nhật ký máy chủ để bảo mật và chống lạm dụng.', 'Chúng tôi không lưu số thẻ hay thông tin tài khoản ngân hàng của bạn; việc đó do cổng thanh toán xử lý.'] },
          { title: '2. Chúng tôi dùng dữ liệu để làm gì', body: ['- Cung cấp dịch vụ: đăng nhập, lưu báo cáo, tính lượt hỏi AI, xử lý thanh toán.', '- Gửi email giao dịch: xác minh địa chỉ, đặt lại mật khẩu, xác nhận đơn. Chúng tôi không gửi email quảng cáo nếu bạn chưa đồng ý riêng.', '- Bảo mật và chống gian lận; cải thiện dịch vụ ở mức thống kê tổng hợp.'] },
          { title: '3. Chia sẻ với bên thứ ba', body: ['Chúng tôi chỉ chia sẻ phần dữ liệu cần thiết với các bên xử lý thay mặt chúng tôi:', '- Nhà cung cấp AI (Anthropic): khi bạn dùng câu trả lời AI, nội dung câu hỏi và dữ liệu công cụ liên quan được gửi để tạo câu trả lời. Không gửi email hay mật khẩu của bạn.', '- Cổng thanh toán: khi bạn mua gói, bạn được chuyển sang cổng thanh toán; chúng tôi nhận kết quả giao dịch.', '- Nhà cung cấp email: để gửi các email giao dịch nói trên.', '- Nhà cung cấp hạ tầng (máy chủ, cơ sở dữ liệu).', 'Chúng tôi không bán dữ liệu cá nhân. Chúng tôi có thể cung cấp dữ liệu cho cơ quan nhà nước khi pháp luật yêu cầu.'] },
          { title: '4. Cookie và công cụ thống kê', body: ['Chúng tôi dùng một cookie phiên (h100_sid) để giữ trạng thái đăng nhập; cookie này cần thiết cho dịch vụ. Trình duyệt của bạn cũng lưu một số cài đặt cục bộ (giao diện sáng/tối, ngôn ngữ, báo cáo chưa đăng nhập).', 'Nếu bật thống kê truy cập, chúng tôi chỉ dùng công cụ không cookie, không theo dõi bạn giữa các trang web và không lưu thông tin nhận dạng cá nhân.'] },
          { title: '5. Thời gian lưu trữ', body: ['Dữ liệu tài khoản được giữ đến khi bạn xoá tài khoản. Khi xoá, báo cáo đã lưu và thông tin đăng nhập bị xoá; dữ liệu đơn hàng có thể được giữ thêm theo thời hạn kế toán, thuế mà pháp luật yêu cầu. Nhật ký máy chủ được giữ ngắn hạn.'] },
          { title: '6. Quyền của bạn', body: ['Theo Nghị định 13/2023/NĐ-CP, bạn có quyền được biết, đồng ý hoặc rút lại đồng ý, truy cập, chỉnh sửa, xoá, hạn chế xử lý, phản đối xử lý và khiếu nại về dữ liệu cá nhân của mình.', `Bạn tự sửa tên, đổi mật khẩu, tải về toàn bộ dữ liệu của mình (một tệp JSON) hoặc xoá tài khoản ngay trong mục Tài khoản. Với yêu cầu khác (rút lại đồng ý, hạn chế xử lý…), gửi email đến ${contact()}; chúng tôi phản hồi trong thời hạn pháp luật quy định.`] },
          { title: '7. Bảo mật', body: ['Mật khẩu được băm bằng thuật toán scrypt; phiên đăng nhập dùng cookie HttpOnly; đường truyền dùng HTTPS khi triển khai chính thức. Không hệ thống nào an toàn tuyệt đối; nếu có sự cố ảnh hưởng đến dữ liệu của bạn, chúng tôi sẽ thông báo theo quy định.'] },
          { title: '8. Trẻ em', body: ['Dịch vụ không dành cho người dưới 16 tuổi. Nếu bạn là cha mẹ hoặc người giám hộ và cho rằng trẻ đã cung cấp dữ liệu, hãy liên hệ để chúng tôi xoá.'] },
          { title: '9. Thay đổi và liên hệ', body: [`Chúng tôi sẽ cập nhật trang này khi dịch vụ thay đổi và ghi ngày hiệu lực ở đầu trang. Liên hệ: ${contact()}${LEGAL.address ? ` · ${LEGAL.address}` : ''}.`] },
        ],
      };
    case 'refund':
      return {
        title: 'Chính sách hoàn tiền',
        description: 'Khi nào Hanoi Century Vista hoàn tiền Premium, gói lượt hỏi AI và báo cáo trả phí, và cách yêu cầu.',
        lead: `Các sản phẩm của chúng tôi là sản phẩm số, được kích hoạt ngay sau khi thanh toán thành công. Chính sách dưới đây áp dụng cho Premium, gói lượt hỏi AI và báo cáo trả phí.`,
        sections: [
          { title: '1. Trường hợp được hoàn tiền', body: [`Bạn được hoàn tiền trong ${LEGAL.refundDays} ngày kể từ ngày thanh toán nếu:`, '- đã bị trừ tiền nhưng sản phẩm không được kích hoạt (lỗi thanh toán, lỗi hệ thống) và chúng tôi không khắc phục được;', '- bị trừ tiền nhiều lần cho cùng một đơn;', '- sản phẩm không dùng được do lỗi của dịch vụ kéo dài và chúng tôi không khắc phục được.'] },
          { title: '2. Trường hợp không hoàn tiền', body: ['- Lượt hỏi AI, báo cáo hoặc thời hạn Premium đã sử dụng một phần (phần chưa dùng có thể được xét hoàn theo tỷ lệ nếu lỗi thuộc về dịch vụ);', '- thay đổi ý định sau khi đã dùng sản phẩm;', '- kết quả tham khảo không như kỳ vọng của bạn, vì dữ liệu và câu trả lời mang tính tham khảo;', '- tài khoản bị khoá do vi phạm điều khoản.', 'Quy định này không làm mất quyền lợi mà pháp luật bảo vệ người tiêu dùng dành cho bạn.'] },
          { title: '3. Cách yêu cầu hoàn tiền', body: [`Gửi email đến ${contact()} từ địa chỉ email tài khoản, ghi mã đơn (dạng HCV…), ngày thanh toán và lý do. Chúng tôi phản hồi trong vòng 3 ngày làm việc.`, 'Khoản hoàn được chuyển về phương thức thanh toán ban đầu (thường là chuyển khoản ngân hàng) trong vòng 7–14 ngày làm việc sau khi được chấp thuận. Gói hoặc lượt tương ứng sẽ bị thu hồi.'] },
          { title: '4. Lượt hỏi AI bị lỗi', body: ['Nếu AI không trả lời được, lượt hỏi được tự động hoàn lại vào tài khoản; bạn không cần yêu cầu gì thêm.'] },
          { title: '5. Liên hệ', body: [`${who()} · ${contact()}${LEGAL.phone ? ` · ${LEGAL.phone}` : ''}.`] },
        ],
      };
  }
}

/** What the English texts say before anything else: they are a translation, the Vietnamese text is the one that applies. */
const EN_NOTE = 'This English text is a courtesy translation. If it differs from the Vietnamese text, the Vietnamese text applies.';

/** An English version of the same three documents (a draft, like the Vietnamese one: it is not legal advice). */
function legalDocEn(kind: LegalKind): LegalDoc {
  const place = LEGAL.address ? ` · ${LEGAL.address}` : '';
  switch (kind) {
    case 'terms':
      return {
        title: 'Terms of Use',
        description: 'The Terms of Use of Hanoi Century Vista: the scope of the service, accounts, Premium, AI questions, limits of liability.',
        lead: `${EN_NOTE} By creating an account or using Hanoi Century Vista (the "service") you agree to the terms below. The service is run by ${who()}.`,
        sections: [
          { title: '1. What the service is', body: ['Hanoi Century Vista offers maps, scores and reference analysis about Hanoi: the Business Opportunity Map, Hanoi Time Machine, Living Score, Hanoi Future Map, AI Property Intelligence and Hanoi Career Compass.', 'The data and results are for reference only. Many figures are samples, estimates or scenarios; each tool states its sources, the date of its data and its reliability where it has one. The service is not investment, legal, financial, career or real-estate advice.'] },
          { title: '2. Accounts', body: ['You need a valid email and a password to create an account. You are responsible for keeping the password secret and for everything done in the account.', 'You can delete the account at any time in the Account section; the saved reports are deleted with it.', 'We may suspend an account that shows signs of abuse, fraud or overloading the system.'] },
          { title: '3. Premium, AI questions and paid reports', body: ['Some free features are limited per day (Vietnam time). Premium and the AI question packs are digital products, paid once for the period or the number of questions shown on the Premium page; they do not renew automatically unless the page says so.', 'An AI question is only used when the answer is really written by the AI; if the AI fails and the system answers from a template, the question is given back.', 'Prices, quantities and periods may change for later purchases; completed purchases are not affected. The refund policy is on the Refund policy page.'] },
          { title: '4. AI answers', body: ['AI answers are produced from the data of the service and may be incomplete or wrong. Check important information against its source before you decide.'] },
          { title: '5. What you may and may not do', body: ['You may use the service for your own lawful personal or business purposes. You may not:', '- collect data in bulk, automate access or get around the usage limits;', '- try to gain unauthorised access, scan for weaknesses or disrupt the service;', '- resell or redistribute the data or the paid reports of the service without permission;', '- enter content that breaks the law or infringes the rights of others.'] },
          { title: '6. Ownership and third-party data', body: ['The source code, the design and the content produced by the service belong to its owner. Map data comes from OpenStreetMap (© OpenStreetMap contributors, ODbL licence) and from other public sources named in each tool.', 'The archive photographs in Hanoi Time Machine belong to their owners and are credited beside each photograph.'] },
          { title: '7. Limits of liability', body: ['The service is provided "as is". To the extent the law allows, we are not liable for indirect damage, lost profit or the business or investment decisions you make on the strength of reference results. Our total liability to a customer does not exceed what the customer has paid for the service in the last 12 months. This does not remove the rights that consumer-protection law gives you.'] },
          { title: '8. Changes to the terms', body: ['We may update the terms and will change the effective date at the top of the page. For an important change we will tell you in the service or by email. Continuing to use the service after the effective date means you accept the new version.'] },
          { title: '9. Governing law and contact', body: ['These terms are governed by the law of Vietnam. Disputes are settled first by negotiation; if that fails, by the competent court in Vietnam.', `Contact: ${contact()}${place}.`] },
        ],
      };
    case 'privacy':
      return {
        title: 'Privacy Policy',
        description: 'How Hanoi Century Vista collects, uses and protects your personal data, and your rights under Decree 13/2023/ND-CP.',
        lead: `${EN_NOTE} This page explains what data ${who()} collects, what it is used for, who it is shared with and which rights you have.`,
        sections: [
          { title: '1. The data we collect', body: ['- Account: your email, display name (if you give one), password (kept only as a hash, never in the clear), when you created the account, when you accepted the terms and when you verified your email.', '- What you save: saved reports of the Business Opportunity Map, career plans and answers, settings, and purchase details (order code, amount, status, AI questions used).', '- The questions you type into the AI tools.', '- Technical: the sign-in session cookie (HttpOnly), your IP address and browser details in the server log, for security and to prevent abuse.', 'We do not keep your card number or bank account details; the payment gateway handles them.'] },
          { title: '2. What we use the data for', body: ['- To provide the service: signing in, saving reports, counting AI questions, processing payments.', '- To send transactional email: verifying your address, resetting your password, confirming an order. We do not send advertising email unless you agree to it separately.', '- Security and fraud prevention; improving the service from aggregate statistics.'] },
          { title: '3. Sharing with third parties', body: ['We share only the data that is needed with the parties that process it for us:', '- The AI provider (Anthropic): when you use an AI answer, your question and the related tool data are sent to produce the answer. Your email and password are not sent.', '- The payment gateway: when you buy a plan you are sent to the payment gateway; we receive the result of the transaction.', '- The email provider: to send the transactional emails above.', '- Infrastructure providers (servers, database).', 'We do not sell personal data. We may give data to State agencies when the law requires it.'] },
          { title: '4. Cookies and statistics', body: ['We use one session cookie (h100_sid) to keep you signed in; it is necessary for the service. Your browser also keeps some settings locally (light/dark theme, language, reports you saved without signing in).', 'If we turn on visit statistics, we use only a tool without cookies, that does not follow you between websites and keeps no personal identifiers.'] },
          { title: '5. How long we keep data', body: ['Account data is kept until you delete the account. When you do, the saved reports and the sign-in details are deleted; order data may be kept for the accounting and tax period the law requires. Server logs are kept for a short time.'] },
          { title: '6. Your rights', body: ['Under Decree 13/2023/ND-CP you have the right to know, to consent or withdraw consent, to access, correct and delete your personal data, to restrict or object to its processing, and to complain about it.', `You can change your name, change your password, download all your data (one JSON file) or delete the account yourself in the Account section. For anything else (withdrawing consent, restricting processing...), email ${contact()}; we reply within the time the law sets.`] },
          { title: '7. Security', body: ['Passwords are hashed with scrypt; the session uses an HttpOnly cookie; the connection uses HTTPS when the service is deployed. No system is completely safe; if an incident affects your data we will tell you as the rules require.'] },
          { title: '8. Children', body: ['The service is not for people under 16. If you are a parent or guardian and think a child has given us data, contact us and we will delete it.'] },
          { title: '9. Changes and contact', body: [`We will update this page when the service changes and show the effective date at the top. Contact: ${contact()}${place}.`] },
        ],
      };
    case 'refund':
      return {
        title: 'Refund policy',
        description: 'When Hanoi Century Vista refunds Premium, AI question packs and paid reports, and how to ask.',
        lead: `${EN_NOTE} Our products are digital and are activated as soon as the payment succeeds. The policy below applies to Premium, AI question packs and paid reports.`,
        sections: [
          { title: '1. When you get a refund', body: [`You get a refund within ${LEGAL.refundDays} days of the payment if:`, '- you were charged but the product was not activated (a payment or system error) and we cannot fix it;', '- you were charged more than once for the same order;', '- the product cannot be used because of a lasting fault of the service that we cannot fix.'] },
          { title: '2. When there is no refund', body: ['- AI questions, reports or Premium time already partly used (the unused part may be refunded in proportion if the fault is the service\'s);', '- a change of mind after the product has been used;', '- reference results that are not what you hoped for, since the data and the answers are for reference;', '- an account suspended for breaking the terms.', 'This does not remove the rights that consumer-protection law gives you.'] },
          { title: '3. How to ask for a refund', body: [`Email ${contact()} from the email address of the account, with the order code (like HCV...), the date of payment and the reason. We reply within 3 working days.`, 'An approved refund is sent back by the original payment method (usually a bank transfer) within 7-14 working days. The matching plan or questions are taken back.'] },
          { title: '4. AI questions that fail', body: ['If the AI cannot answer, the question is given back to the account automatically; you do not need to ask.'] },
          { title: '5. Contact', body: [`${who()} · ${contact()}${LEGAL.phone ? ` · ${LEGAL.phone}` : ''}.`] },
        ],
      };
  }
}
