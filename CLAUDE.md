# Kopytsia website

Kopytsia makes hats. The site’s primary job is to start a conversation about a custom hat. The project is greenfield. Use Ukrainian for the initial customer-facing UI and preserve the approved names below. Confirm additional languages with the owner before adding them.

## Launch scope

The homepage’s primary call to action is **«Замовити кастомний капелюх»**. It leads to the custom section with examples and a short inquiry form.

| Main menu | Content and actions |
| --- | --- |
| **Кастомний капелюх** | Gallery of past work, inquiry form, and custom-order FAQs. Provide clear entry points to the 3D configurator and camera try-on. |
| **Лінійки** | Orderable designs with simpler shapes and clearer designs. Support both in-stock and made-to-order models. Show price, availability, and lead time for each. Provide a model-specific inquiry action. |
| **Гуцульщина** | Tell the story of Баршівка, the Hutsul horned hat. Provide separate inquiry actions for the hat and the book. |
| **Більше** | Launch with electronic gift certificates in three fixed denominations ($200, $300, $500). Let visitors select a denomination and submit an inquiry. Allow more products to be added later. |

- **Блог** can start with «Як вибрати розмір» and «Як доглядати за капелюхом». Link to these guides from relevant forms and product pages. Support future helpful articles, press mentions, and search visibility.
- **Хто ми?** tells the brand story.
- **Відгуки** shows real customer reviews and provides a feedback form.
- Place a general **Часті питання** block near the end of the homepage. Put brand contacts and links to all confirmed social accounts in the footer.
- Defer online payments and the shipping section. Keep returns and legal content as open owner inputs. Confirm seller details, markets, and applicable requirements before publishing policies.

## Inquiries

The website accepts inquiries. The owner confirms orders by email. The custom form asks for a name, a way to contact the customer, a short description, and an optional reference image. All order inquiries go to **artemh@gmail.com**. Include the request type and selected item or certificate denomination where applicable. For configurator inquiries, carry the selected options into the form so the owner can refer to them in the conversation.

Use a server-side submission endpoint and keep email credentials in environment variables. Validate fields and optional uploads on the server, limit abuse, and preserve entered details when a submission fails. Report success only after the email service accepts the message. Configure the production email service and verify delivery to the destination inbox before launch. Use a test destination or a mock when developing.

## 3D experiences

Both features are required for v1 and have separate flows.

- **Конструктор капелюха** lets visitors assemble and inspect a hat in 3D by choosing interchangeable elements. The owner has yet to confirm the option list. Keep assets and option definitions replaceable without rewriting the UI. Retain a readable summary of selections for the inquiry.
- **Віртуальна примірка** is a live camera filter that positions a 3D hat on the visitor’s head as they move. Target about 15 predefined hat forms, with color variants where supplied. The final list and production assets are pending. Ask for camera access when the visitor starts try-on. Handle denied permission and unsupported devices, stop the camera on exit, and keep camera processing local to the browser. Visitors can still browse and submit inquiries without the camera.
- **Possible v2** lets visitors try on the exact hat assembled in the configurator if the two experiences can share compatible 3D assets. Keep this integration outside v1.

## Open inputs

- Brand identity, photography, product descriptions, prices, availability, lead times, book details, and approved copy about Баршівка and the brand.
- Final list of try-on shapes and colors, reference materials or production 3D assets, and the configurable elements and their compatibility rules.
- Public contact details, social links, real reviews, launch FAQs, and the process for handling customer feedback.
- Seller and market details for legal and returns copy, plus hosting and an email delivery provider.

Use clearly marked placeholders in development and keep pending content easy to replace. Confirm facts and assets before publication.

## How to start

1. Inspect the workspace. If it is empty, propose a small, maintainable stack that supports server-side email, Ukrainian content, and browser 3D. Record the stack choice and setup commands in the README when scaffolding.
2. Build the responsive navigation, homepage, product sections, and inquiry flow. Keep product data, FAQs, and content separate from components so the owner can replace provisional content.
3. Prove the 3D workflows early with a clearly marked sample asset. Test a configurable hat and a tracked camera overlay on representative desktop and mobile browsers before building out the final asset set. Load the 3D experiences on demand so the rest of the site remains usable.
4. Before launch, verify mobile navigation, keyboard access, submission success and failure, production email delivery, camera permission and teardown, and the final content and assets. Keep unfinished features and placeholder content out of the production launch.
