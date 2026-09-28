import { expect, it } from "vitest";
import { formatCustomerText } from "@/lib/customer-format";
import { customerSchema, customerFields } from "@/lib/validation";

it("respeta tildes, nombres compuestos y partículas sin convertir correo o documento a título", () => {
  expect(formatCustomerText("jUAN de la cRUZ")).toBe("Juan de la Cruz");
  expect(formatCustomerText("de la cRUZ")).toBe("de la Cruz");
  expect(formatCustomerText("o'CONNOR mcdonald")).toBe("O'Connor McDonald");
  expect(formatCustomerText("la ceJA", "place")).toBe("La Ceja");
  const customer = customerSchema.parse({ firstName: " jUAN ", lastName: " de la cRUZ ", phone: "3001234567", email: "JUAN@EXAMPLE.COM", documentType: "pasaporte", documentNumber: "ab123", city: "la ceJA" });
  expect(customer).toMatchObject({ firstName: "Juan", lastName: "de la Cruz", email: "juan@example.com", documentType: "PASAPORTE", documentNumber: "AB123", city: "La Ceja" });
  expect(customerFields.partial().parse({ lastName: "o'CONNOR", city: "la ceJA" })).toMatchObject({ lastName: "O'Connor", city: "La Ceja" });
});
