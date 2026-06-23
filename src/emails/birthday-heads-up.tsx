import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export default function BirthdayHeadsUp({
  celebrantName,
  directoryUrl,
}: {
  celebrantName: string;
  directoryUrl: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>It is {celebrantName}&apos;s birthday today</Preview>
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
          <Text style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 8px" }}>
            It is {celebrantName}&apos;s birthday today. A quick note can make
            their day.
          </Text>
          <Section style={{ margin: "16px 0" }}>
            <a
              href={directoryUrl}
              style={{
                backgroundColor: "#14346B",
                color: "#FFFFFF",
                padding: "10px 16px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Find them in the directory
            </a>
          </Section>
          <Text style={{ fontSize: 12, lineHeight: 1.6, color: "#737373" }}>
            You receive these because birthday heads-ups are on in your
            notification settings.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
