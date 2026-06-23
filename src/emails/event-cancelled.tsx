import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

export default function EventCancelled({
  title,
  whenLabel,
}: {
  title: string;
  whenLabel: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>Cancelled: {title}</Preview>
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
            This event has been cancelled
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 2px" }}>
            {title}
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 16px", color: "#737373" }}>
            {whenLabel}
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 1.6 }}>
            We are sorry for any inconvenience. The attached update will remove it
            from your calendar.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
