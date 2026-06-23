import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

export default function BirthdayWish({ name }: { name: string }) {
  return (
    <Html>
      <Head />
      <Preview>Happy birthday from everyone at Set</Preview>
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
            Happy birthday, {name}.
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 8px" }}>
            The whole alumni community is wishing you a wonderful day. Thank you
            for being part of Set.
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 1.6, color: "#737373" }}>
            Have a great year ahead.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
