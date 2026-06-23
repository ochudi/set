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

export default function AnnouncementEmail({
  title,
  excerpt,
  url,
}: {
  title: string;
  excerpt: string;
  url: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>{title}</Preview>
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
          <Text style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>
            {title}
          </Text>
          <Text
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              margin: "0 0 16px",
              whiteSpace: "pre-line",
            }}
          >
            {excerpt}
          </Text>
          <Section style={{ margin: "8px 0 16px" }}>
            <a
              href={url}
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
              Read the full announcement
            </a>
          </Section>
          <Hr style={{ borderColor: "#E5E5E5", margin: "16px 0" }} />
          <Text style={{ fontSize: 12, lineHeight: 1.6, color: "#737373" }}>
            You receive these because announcement emails are on in your
            notification settings. Use the unsubscribe link to turn them off.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
