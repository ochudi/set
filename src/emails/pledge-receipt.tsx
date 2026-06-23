import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";

export default function PledgeReceipt({
  name,
  amount,
  campaign,
}: {
  name: string;
  amount: string; // pre-formatted naira
  campaign: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>Your pledge to {campaign} is logged</Preview>
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
            Thank you, {name}. Your pledge is logged.
          </Text>
          <Text style={{ fontSize: 18, fontWeight: 600, margin: "8px 0" }}>
            {amount} to {campaign}
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 1.6, margin: "8px 0" }}>
            The treasurer will reach out with payment details and confirm once it
            is received.
          </Text>
          <Hr style={{ borderColor: "#E5E5E5", margin: "16px 0" }} />
          <Text style={{ fontSize: 12, lineHeight: 1.6, color: "#737373" }}>
            A pledge is a promise to give, not a payment. If this was not you,
            you can ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
