<?php

declare(strict_types=1);

namespace App\Shared\Domain;

use InvalidArgumentException;

final class InvalidIdException extends InvalidArgumentException
{
    public static function invalidIdentifierFormat(string $invalidId): self
    {
        return new self(sprintf('%s is invalid id. Correct id format is ULID', $invalidId));
    }
}
