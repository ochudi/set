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

export default function InviteEmail({
  url,
  inviterName,
}: {
  url: string;
  inviterName?: string | null;
}) {
  const from = inviterName ? `${inviterName} invited you` : "You are invited";
  return (
    <Html>
      <Head />
      <Preview>{from} to join the Set alumni community.</Preview>
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
            {from} to join Set, the alumni community. Accept your invitation to
            set up your profile. The link below works once and the invitation
            expires in 30 days.
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
              Accept invitation
            </Button>
          </Section>
          <Text style={{ fontSize: 12, lineHeight: 1.6, color: "#737373" }}>
            If you were not expecting this, you can ignore this email and nothing
            will happen.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
