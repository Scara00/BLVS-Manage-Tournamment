// @vitest-environment node
import { describe, expect, it } from "vitest";
import { emailTemplates, isEmailTemplateName, renderEmail } from "./render";

const casi = [
  {
    name: "conferma-email",
    props: { confirmationUrl: "https://blvs.example/auth/conferma?t=abc&x=1" },
    subject: "Conferma il tuo indirizzo email · BLVS",
    heading: "Conferma il tuo indirizzo email",
    link: "https://blvs.example/auth/conferma?t=abc&x=1",
  },
  {
    name: "reimposta-password",
    props: { resetUrl: "https://blvs.example/auth/nuova-password?t=xyz" },
    subject: "Reimposta la password · BLVS",
    heading: "Reimposta la password",
    link: "https://blvs.example/auth/nuova-password?t=xyz",
  },
  {
    name: "tappa-annullata",
    props: {
      stageName: "Tappa di Rimini",
      startsAt: "2027-06-12T07:30:00.000Z",
      location: "Bagno 26, Rimini",
      reason: "Allerta meteo",
      detailsUrl: "https://blvs.example/tappe/rimini-2027",
    },
    subject: "Tappa annullata: Tappa di Rimini · BLVS",
    heading: "Tappa annullata",
    link: "https://blvs.example/tappe/rimini-2027",
  },
] as const;

describe("renderEmail", () => {
  it("copre tutti i modelli", () => {
    expect(Object.keys(emailTemplates).sort()).toEqual(
      casi.map((c) => c.name).sort(),
    );
    expect(isEmailTemplateName("tappa-annullata")).toBe(true);
    expect(isEmailTemplateName("toString")).toBe(false);
  });

  describe.each(casi)("$name", ({ name, props, subject, heading, link }) => {
    it("ha oggetto in italiano e HTML con lang it", async () => {
      const email = await renderEmail(name, props as never);
      expect(email.subject).toBe(subject);
      expect(email.html).toMatch(/^<!DOCTYPE html/);
      expect(email.html).toMatch(/<html[^>]*\slang="it"/);
      expect(email.html).toContain(`<h1`);
      expect(email.html).toContain(heading);
      expect(email.html).toContain(`href="${link.replaceAll("&", "&amp;")}"`);
    });

    it("ha una versione solo testo con il titolo e il link per esteso", async () => {
      const { text } = await renderEmail(name, props as never);
      expect(text).toContain(heading);
      expect(text).toContain(link);
      expect(text).not.toMatch(/<[a-z!/]/i);
      // The button is skipped: the URL appears once, in the fallback line.
      expect(text.split(link)).toHaveLength(2);
    });
  });

  it("tappa annullata: data e ora in Europe/Rome, motivo e luogo", async () => {
    const { text } = await renderEmail("tappa-annullata", casi[2].props);
    expect(text).toContain("sabato 12 giugno 2027 alle ore 09:30");
    expect(text).toContain("a Bagno 26, Rimini");
    expect(text).toContain("Motivo: Allerta meteo");
  });

  it("tappa annullata: senza motivo né luogo non lascia testo vuoto", async () => {
    const { text } = await renderEmail("tappa-annullata", {
      stageName: "Tappa di Bari",
      startsAt: "2027-01-10T09:00:00.000Z",
      detailsUrl: "https://blvs.example/tappe/bari",
    });
    expect(text).toContain("domenica 10 gennaio 2027 alle ore 10:00 è stata");
    expect(text).not.toContain("Motivo");
  });

  it("i dati inseriti dagli utenti sono escapati nell'HTML", async () => {
    const { html, subject } = await renderEmail("tappa-annullata", {
      stageName: '<script>alert("x")</script>',
      startsAt: "2027-01-10T09:00:00.000Z",
      reason: "<b>no</b>",
      detailsUrl: "https://blvs.example/tappe/x",
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>no</b>");
    expect(html).toContain("&lt;script&gt;");
    expect(subject).toBe('Tappa annullata: <script>alert("x")</script> · BLVS');
  });

  it("reimposta password: indica la validità del link", async () => {
    const { text } = await renderEmail("reimposta-password", {
      resetUrl: "https://blvs.example/r",
      validityMinutes: 30,
    });
    expect(text).toContain("valido per 30 minuti");
  });
});
