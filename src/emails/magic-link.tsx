import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export default function MagicLinkEmail({ url }: { url: string }) {
  return (
    <Html>
      <Head />
      <Preview>Your sign-in link for Set. It expires in 10 minutes.</Preview>
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
            Here is your sign-in link. It expires in 10 minutes and works once.
          </Text>
          <Section style={{ margin: "24px 0" }}>
            <Button
              href={url}
              style={{
                backgroundColor: "#14346B",
                color: "#FFFFFF",
                padding: "12px 20px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Sign in to Set
            </Button>
          </Section>
          <Text style={{ fontSize: 12, lineHeight: 1.6, color: "#737373" }}>
            If you did not request this, you can ignore this email and nothing
            will happen.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
