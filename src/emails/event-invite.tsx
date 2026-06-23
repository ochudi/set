import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export default function EventInvite({
  title,
  whenLabel,
  whereLabel,
  rsvpUrls,
  eventUrl,
}: {
  title: string;
  whenLabel: string;
  whereLabel: string;
  rsvpUrls: { going: string; maybe: string; declined: string };
  eventUrl: string;
}) {
  const btn = (bg: string, color: string): React.CSSProperties => ({
    backgroundColor: bg,
    color,
    padding: "10px 16px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    textDecoration: "none",
    display: "inline-block",
    marginRight: 8,
  });

  return (
    <Html>
      <Head />
      <Preview>You are invited: {title}</Preview>
      <Body
        style={{
          backgroundColor: "#FAFAFA",
          fontFamily: "Inter, Arial, sans-serif",
          color: "#0A0A0A",
          margin: 0,
          padding: "32px 0",
        }}
      >
        <Container style={{ maxWidth: 480, margin: "0 auto", padding: "0 24px" }}>
          <Heading style={{ fontSize: 24, fontWeight: 600, margin: "0 0 16px" }}>
            Set.
          </Heading>
          <Text style={{ fontSize: 18, fontWeight: 600, margin: "0 0 4px" }}>
            {title}
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 2px", color: "#737373" }}>
            {whenLabel}
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 16px", color: "#737373" }}>
            {whereLabel}
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 12px" }}>
            Will you be there? Tap to RSVP. Your reply is saved when the page
            opens and asks you to confirm.
          </Text>
          <Section style={{ margin: "8px 0 16px" }}>
            <a href={rsvpUrls.going} style={btn("#14346B", "#FFFFFF")}>
              I am going
            </a>
            <a href={rsvpUrls.maybe} style={btn("#F5F5F5", "#0A0A0A")}>
              Maybe
            </a>
            <a href={rsvpUrls.declined} style={btn("#F5F5F5", "#0A0A0A")}>
              Can&apos;t go
            </a>
          </Section>
          <Hr style={{ borderColor: "#E5E5E5", margin: "16px 0" }} />
          <Text style={{ fontSize: 12, lineHeight: 1.6, color: "#737373" }}>
            The attached .ics adds it to your calendar. Full details:{" "}
            <a href={eventUrl} style={{ color: "#14346B" }}>
              {eventUrl}
            </a>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
