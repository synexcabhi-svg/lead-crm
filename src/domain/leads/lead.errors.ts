import { ApiError } from "@/lib/http";

/** Thrown when DUPLICATE_STRATEGY=reject and a matching lead already exists. */
export class DuplicateLeadError extends ApiError {
  constructor(public existingId: string, matchedOn: string[]) {
    super(409, `A lead with the same ${matchedOn.join(" or ")} already exists`, {
      existingId,
      matchedOn,
    });
    this.name = "DuplicateLeadError";
  }
}

export class LeadNotFoundError extends ApiError {
  constructor(id: string) {
    super(404, `Lead ${id} not found`);
    this.name = "LeadNotFoundError";
  }
}

export class InvalidReferenceError extends ApiError {
  constructor(field: string, value: string) {
    super(422, `Unknown ${field}: "${value}"`, { field, value });
    this.name = "InvalidReferenceError";
  }
}
