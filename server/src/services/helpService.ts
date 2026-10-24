import { storePool } from '../db/mysql.js';
import { validateHelpBody, type HelpInput } from '../utils/helpContent.js';

export type HelpFaq = { id: number; question: string; answer: string; position: number };

export type HelpContent = {
  phone: string;
  phoneLabel: string;
  whatsapp: string;
  email: string;
  hours: string;
  faqs: HelpFaq[];
};

export class HelpService {
  static async get(): Promise<HelpContent> {
    const [contacts] = await storePool.query<any[]>(
      `SELECT Phone as phone, PhoneLabel as phoneLabel, Whatsapp as whatsapp, Email as email, Hours as hours
       FROM help_contact WHERE ID = 1 LIMIT 1`
    );
    const [faqs] = await storePool.query<any[]>(
      `SELECT ID as id, Question as question, Answer as answer, Position as position
       FROM help_faqs ORDER BY Position ASC, ID ASC`
    );
    const contact = contacts[0];
    return {
      phone: contact ? String(contact.phone ?? '') : '',
      phoneLabel: contact ? String(contact.phoneLabel ?? '') : '',
      whatsapp: contact ? String(contact.whatsapp ?? '') : '',
      email: contact ? String(contact.email ?? '') : '',
      hours: contact ? String(contact.hours ?? '') : '',
      faqs: faqs.map((row) => ({
        id: Number(row.id),
        question: String(row.question),
        answer: String(row.answer),
        position: Number(row.position),
      })),
    };
  }

  /** Replaces the page. An empty body clears it. */
  static async save(body: unknown): Promise<HelpContent> {
    const next: HelpInput = validateHelpBody(body);
    const conn = await storePool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `INSERT INTO help_contact (ID, Phone, PhoneLabel, Whatsapp, Email, Hours, UpdatedDate, UpdatedTime)
         VALUES (1, ?, ?, ?, ?, ?, CURDATE(), CURTIME())
         ON DUPLICATE KEY UPDATE
           Phone = VALUES(Phone), PhoneLabel = VALUES(PhoneLabel), Whatsapp = VALUES(Whatsapp),
           Email = VALUES(Email), Hours = VALUES(Hours), UpdatedDate = CURDATE(), UpdatedTime = CURTIME()`,
        [next.phone, next.phoneLabel, next.whatsapp, next.email, next.hours]
      );
      await conn.query(`DELETE FROM help_faqs`);
      for (let i = 0; i < next.faqs.length; i++) {
        const faq = next.faqs[i];
        await conn.query(
          `INSERT INTO help_faqs (Question, Answer, Position, CreatedDate, CreatedTime)
           VALUES (?, ?, ?, CURDATE(), CURTIME())`,
          [faq.question, faq.answer, i + 1]
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    return HelpService.get();
  }
}
